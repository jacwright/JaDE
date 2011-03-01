/**
 * 
 * @module global
 */
var Jade, q;

(function() {

var defaultId = '_id';

/**
 * Javascript Database
 * @class Jade
 * @param Object options Configuration options
 */
Jade = function(options) {
	options = options || {};
	this._store = [];
	this._lookup = {};
	this._idField = options.id || defaultId;
	if (options.bucket) this._bucket = options.bucket;
	if (options.index) this.index(options.index);

	// this data should be loaded from and stored into localStorage by this key
	if (options.bucket && typeof localStorage != 'undefined') {
		this.restore();
		var self = this;
		var flush = function() {
			self.flush(true);
		};

		if (window.attachEvent) window.attachEvent('onunload', flush);
		else window.addEventListener('unload', flush, false);
	}
};

Jade.prototype = {

	/**
	 * Returns an array of records which match the provided filters, or all the records if no filters are specified. The
	 * second parameter may be provided as the source for the record search.
	 *
	 * @param {Jade.query|Object|int} filters An object of {property: filter} format or a filter function, or an id.
	 * @param {Array} [records] An optional array of object to search. If not provided will use all records in the database.
	 * @return {Array|Object} A single record if an id was provided for filters, otherwise an array of records.
	 */
	get: function(filters, records) {
		if (isId(filters)) { // id
			var record = this._lookup[filters];
			return record ? [record] : [];
		} else if (filters instanceof Jade.query) {
			return this._query(records || this._store, filters);
		} else {
			return this._filter(records || this._store, filters);
		}
	},

	first: function(filters, records) {
		return this.get(filters, records)[0];
	},
	
	last: function(filters, records) {
		records = this.get(filters, records);
		return records[records.length - 1];
	},

	add: function(obj, silent) {
		if (type(obj) == 'array') {
			var self = this;
			var ids = obj.map(function(obj) {
				return self.add(obj, true);
			}).filter(function(id) {
				return id != 0;
			});
			
			if (!silent && ids.length) this.onAdd(obj);
			return ids;
		}

		var id = this._getId(obj);
		if (!id) throw new Error('Jade error: cannot add an item to the database without an id.');
		if (this._lookup[id]) return 0;
		this._store.push(obj);
		this._indexObj(obj);
		this._lookup[id] = obj;
		if (!silent && this.onAdd) this.onAdd([obj]);
		return id;
	},

	update: function(updates, filters, silent) {
		var records = this.get(filters);
		records.forEach(type(updates) == 'function' ? updates : propUpdate(updates));
		if (!silent && this.onUpdate) this.onUpdate(records, updates);
		return records;
	},

	remove: function(filters, silent) {
		var removed = {}, lookup = this._lookup, db = this, objIds = [];
		var records = this.get(filters);
		
		records.forEach(function(obj) {
			var id = db._getId(obj);
			objIds.push(id);
			delete lookup[id];
			removed[id] = true;
		});
		
		db._unindexObj(objIds);
		
		this._store = this._store.filter(function(obj) {
			return !removed[db._getId(obj)];
		});
		
		if (!silent && records.length && this.onRemove) this.onRemove(records);
		return records;
	},
	
	id: function(field) {
		if (!arguments.length) return this._idField;
		
		field = field || defaultId;
		
		this._idField = field;
		var lookup = {};
		
		this._store.forEach(function(obj) {
			delete obj[defaultId];
			lookup[obj[field]] = obj;
		});
		
		this.reindex();
	},

	/**
	 * Sets a group of fields to be included in a full-text index.
	 * @param fields An array of fields to be indexed.
	 */
	index: function(fields) {
		if (!arguments.length) return this._indexFields;
		if (!fields) {
			this._indexFields = this._index = null;
			return;
		}
		
		if (type(fields) == 'string') fields = fields.split(/\s*,\s*/);
		this._index = {};
		this._indexFields = fields;
		var self = this;
		this._store.forEach(function(obj) {
			self._indexObj(obj);
		});
	},
	
	reindex: function() {
		if (!this._indexFields) return;
		this._index = {};
		this._store.forEach(function(obj) {
			self._indexObj(obj);
		});
	},

	flush: function(clean) {
		if (this._bucket && typeof localStorage != 'undefined') {
			var data = this._store;
			if (clean) {
				if (!this.id()) {
					data.forEach(function(obj) {
						delete obj[defaultId];
					});
				}
				this._store = null;
			} 
			localStorage.setItem(this._bucket, JSON.stringify(data));
		}
	},
	
	restore: function() {
		if (this._bucket && typeof localStorage != 'undefined') {
			var data;
			if ((data = localStorage.getItem(this._bucket))) {
				this._store = JSON.parse(data);
				
				if (this._index) this._index = {};
				
				// don't let stored defaultId fields conflict with the live counter
				if (this._idField == defaultId) {
					this._store.forEach(function(obj) {
						obj[defaultId] = ++uuid;
					});
				}
				this.reindex();
			}
		}
	},

	onAdd: null, // function(records) {},

	onUpdate: null, // function(records, updates) {},

	onRemove: null, // function(records) {}

	
	_getId: function(obj) {
		return this._idField != defaultId ? obj[this._idField] : getId(obj);
	},

	_indexObj: function(obj) {
		if (!this._index) return;
		var id = this._getId(obj);
		var terms = this._getAllTerms(obj);
		
		var self = this;
		terms.forEach(function(term) {
			self._hit(term, id);
		});

		return terms;
	},

	_unindexObj: function(objIds) {
		if (!this._index) return;
		var index = this._index;
		for (var chr in index) {
			if (!index.hasOwnProperty(chr)) continue;
			var letter = index[chr];
			for (var i in letter) {
				if (!letter.hasOwnProperty(i)) continue;
				objIds.forEach(function(id) {
					if (letter[i].hasOwnProperty(id)) delete letter[i][id];
				});
			}
		}
	},

	_hit: function(term, id) {
		var chr = term.charAt(0);
		var letter = this._index[chr] || (this._index[chr] = {});
		var hits = letter[term] || (letter[term] = {});
		hits[id] = true;
	},
	
	_getAllTerms: function(obj) {
		var terms = [], getTerms = this._getTerms;
		
		this._indexFields.forEach(function(field) {
			var value;
			try {
				value = eval('obj.' + field);
			} catch (e) {
				return;
			}
			if (value == null) return; // value is null, don't index
			if (value instanceof Array && value.length && type(value[0]) == 'string') {
				value.forEach(function(value) {
					terms.push.apply(terms, getTerms(value));
				});
			} else if (typeof value == 'string') {
				terms.push.apply(terms, getTerms(value));
			}
		});
		
		return terms;
	},
	
	_getTerms: function(value, isQuery) {
		var terms = [];
		value = value.toLowerCase().replace(/-/g, ' ').replace(/^\s+|[,\.'"?!]+|\s+$/g, '');
		if (value == '') return terms;
		
		var tokens = value.split(/\s+/);
		for (var i = 0, l = tokens.length; i < l; i++) {
			var token = tokens[i];
			/*if (!sw[token])*/ terms.push(token); // with custom punctuation (e.g. @twitter, #search, (parenthesis))
			if (!isQuery) {
				var word = token.replace(/^\W+|\W+$/g, ''); // without custom punctuation
				if (word != token) terms.push(word);
			}
		}
		return terms;
	},
	
	_search: function(value) {
		var terms = this._getTerms(value, true), index = this._index;
		if (!index) throw new Error('No index was defined for this database, therefore no searches can be made.');
		var hits;
		
		terms.forEach(function(term) {
			var regex = new RegExp(RegExp.escape(term)), chr = term.charAt(0), terms = index[chr], termHits = {};
			for (var i in terms) {
				if (!terms.hasOwnProperty(i)) continue;
				if (regex.test(i)) {
					var ids = terms[i];
					for (var id in ids) {
						if (ids.hasOwnProperty(id)) termHits[id] = true;
					}
				}
			}
			if (hits) {
				for (var j in hits) {
					if (!termHits[j]) delete hits[j];
				}
			} else {
				hits = termHits;
			}
		});
		
		return hits;
	},
	
	_sort: function(sorts) {
		sorts = sorts.map(function(sort) {
			return sort.toFunction();
		});
		return function(a, b) {
			var direction = 0, i = 0, len = sorts.length;
			while (i < len && direction == 0) {
				direction = sorts[i++](a, b);
			}
			return direction;
		}
	},
	
	_query: function(records, query) {
		if (!query) return records;
		var filter, searches = query._searches, sorts = query._sorts, queryStr = query.toString();
		
		if (queryStr) {
			try {
				eval('filter = function(obj) { try { return ' + queryStr + '; } catch (e) { return false; } }');
			} catch (e) {
				throw new Error('A bug was found in JaDE.query\'s eval() code: "(function(obj) { return ' + query + '; })"');
			}
			
			for (var i in searches) {
				if (searches.hasOwnProperty(i)) {
					searches[i] = this._search(searches[i]);
				}
			}
			
			records = records.filter(filter, query);
		} else {
			records = records.slice();
		}
		
		if (sorts.length) {
			records.sort(this._sort(sorts));
		}
		if (query._offset) {
			records = records.slice(query._offset);
		}
		if (query._limit) {
			records.length = Math.min(records.length, query._limit);
		}
		return records;
	},
	
	/**
	 * Filters the provided set of records with the provided filters. If no filters are given the records are returned.
	 *
	 * @param records An array of records to search.
	 * @param filters A function or object with filters.
	 */
	_filter: function(records, filters) {
		if (!filters) return records;
		records = records.slice();
		
		if (type(filters) == 'array') {
			// handle an array of ids
			if (type(filters[0]) == 'number') {
				records = [];
				filters.forEach(function(id) {
					var obj = this._lookup[id];
					if (obj) records.push(obj);
				});
				return records;
			}

			var self = this;
			filters.forEach(function(filters) {
				records = self._filter(records, filters);
			});
			return records;

		} else if (type(filters) == 'number') {
			records = [];
			var obj = this._lookup[filters];
			if (obj) records.push(obj);
			return records;
		} else if (type(filters) == 'function') {
			records = records.filter(filters);
		} else if (type(filters) == 'string') {
			if (this._index) records = records.filter(providedFilters._search(this._getTerms(filters, true), this._index));
		} else {
			var sort, limit, offset;
			for (var prop in filters) {
				if (!filters.hasOwnProperty(prop)) continue;
				var value = filters[prop];

				// handle special cases first
				if (prop == '_type') {
					records = records.filter(providedFilters._type(value));
				} else if (prop == '_sort') {
					sort = value;
				} else if (prop == '_offset') {
					offset = value;
				} else if (prop == '_limit') {
					limit = value;
				} else if (prop == '_search') {
					if (this._index) records = records.filter(providedFilters._search(this._getTerms(value, true), this._index));
				} else if (type(value) == 'string') {
					records = records.filter(providedFilters.is(prop, value));
				} else if (type(value) == 'array') {
					records = records.filter(providedFilters.within(prop, value));
				} else if (value instanceof RegExp) {
					records = records.filter(providedFilters.regex(prop, value));
				} else if (type(value) == 'object') {
					for (var i in value) {
						if (!value.hasOwnProperty(i)) continue;
						var fltr = providedFilters[i];
						if (fltr) records = records.filter(fltr(prop, value[i]));
						else throw new Error('JaDE Error: Unknown filter "' + i + '" used');
					}
				} else if (type(value) == 'function') {
					records = records.filter(function(record) {
						return value(record[prop]);
					});
				} else {
					throw new Error(value + ' is not a valid filter');
				}
			}

			if (type(sort) == 'function') {
				records.sort(sort);
			} else if (type(sort) == 'string') {
				var order = 1;
				var parts = sort.split(/\s+/);
				sort = parts[0];
				if (parts.length == 2 && parts[1].toLowerCase() == 'desc') order = -1;
				records.sort(providedSorts.regular(sort, order));
			} else if (type(sort) == 'object') {
				// reverse the order of the sorts to the first sort is the strongest
				var sorts = [];
				for (prop in sort) {
					if (!sort.hasOwnProperty(prop)) continue;
					sorts.unshift([prop, sort[prop]]);
				}

				sorts.forEach(function(sort) {
					var prop = sort[0];
					value = sort[1];

					if (type(value) == 'function') {
						records.sort(providedSorts.custom(prop, value));
					} else {
						var order = 1;
						var parts = value.split(/\s+/);
						value = parts[0];
						if (parts.length == 2 && parts[1].toLowerCase() == 'desc') order = -1;
						var srt = providedSorts[value];
						if (srt) records.sort(srt(prop, order));
					}
				});
			}

			if (offset) {
				records = records.slice(offset);
			}

			if (limit) {
				records.length = Math.min(records.length, limit);
			}
		}

		return records;
	}
};


Jade.expression = function(term, operator, value, not) {
	this.term = term;
	this.operator = operator;
	this.value = value;
	this.not = not;
	this.template = '%not(%term %operator %value)';
};
Jade.expression.prototype = {
	
	toString: function() {
		var self = this;
		return this.template.replace(/%\w+/g, function(match) {
			switch(match) {
				case '%not':
					return self.not ? '!' : '';
				case '%term':
					return 'obj.' + self.term + (self.value instanceof Date ? '.getTime()' : '');
				case '%operator':
					return self.operator;
				case '%value':
					return JSON.stringify(self.value instanceof Date ? self.value.getTime() : self.value);
			}
		});
	}
};

Jade.sort = function(term, type, direction) {
	this.term = term;
	this.type = type || this.regular;
	this.direction = direction || 1;
}
Jade.sort.prototype = {
	
	toFunction: function() {
		return this.type(this.term, this.direction);
	},
	regular: function(prop, order) {
		return function(a, b) {
			a = a[prop];
			b = b[prop];
			if (b == null) return -1;
			if (a == null) return 1;
			return order * (a > b ? 1 : (a < b ? -1 : 0));
		};
	},
	numeric: function(prop, order) {
		return function(a, b) {
			a = parseFloat(a[prop]);
			b = parseFloat(b[prop]);
			if (b == null || isNaN(b)) return -1;
			if (a == null || isNaN(a)) return 1;
			return order * (a - b);
		};
	},
	date: function(prop, order) {
		return function(a, b) {
			a = a[prop];
			b = b[prop];
			if (b == null) return -1;
			if (a == null) return 1;
			return order * (a.getTime() - b.getTime());
		};
	},
	custom: function(prop, func) {
		if (prop) {
			return function(a, b) {
				return func(a[prop], b[prop]);
			};
		} else {
			return function(a, b) {
				return func(a, b);
			};
		}
	}
};

var isField = /^[$_a-z][$\w]*$/i;

q = Jade.query = function(field) {
	if ( !(this instanceof Jade.query) ) {
		return new Jade.query(field);
	}
	
	if (field) {
		this._expression = new Jade.expression(field);
	}
	this._eval = '';
	this._lookups = {};
	this._searches = {};
	this._sorts = [];
};
Jade.query.prototype = {
	_add: function(eval, clean) {
		this._eval += eval;
		if (clean) this._expression = null;
		return this;
	},
	_term: function(condition, field) {
		this._flush();
		this._eval += ' ' + condition + ' ';
		if (type(field) == 'string') {
			this._expression = new Jade.expression(field);
		} else if (field instanceof Jade.query) {
			for (var i in field._lookups) {
				if (field._lookups.hasOwnProperty(i)) this._lookups[i] = field._lookups[i];
			}
			this._eval += '(' + field + ')';
		} else if (field) {
			this._eval += '(' + field + ')';
		}
		return this;
	},
	_oper: function(operator, value) {
		if (this._expression) {
			this._expression.operator = operator;
			this._expression.value = value;
		}
		return this;
	},
	_store: function(value, isSearch) {
		var postFix = Math.round(Math.random()*1000000);
		if (isSearch) {
			this._searches[postFix] = value;
			return 'this._searches[' + postFix + ']';
		} else {
			this._lookups[postFix] = value;
			return 'this._lookups[' + postFix + ']';
		}
	},
	_sort: function(param, value) {
		if (this._sorts.length == 0) return;
		var sort = this._sorts[this._sorts.length - 1];
		if (type(param) == 'number') sort.direction = param;
		else {
			sort.type = sort[param];
			if (value !== undefined) sort.direction = value;
		}
		return this;
	},
	_flush: function() {
		if (this._expression) this._eval += this._expression;
		this._expression = null;
	},
	toString: function() {
		this._flush();
		return this._eval;
	},
	and: function(field) {
		return this._term('&&', field);
	},
	or: function(field) {
		return this._term('||', field);
	},
	not: function(field) {
		if (this._expression) this._expression.not = !this._expression.not;
		return this;
	},
	equals: function(value) {
		return this._oper('==', value);
	},
	is: function(value) {
		return this._oper('==', value);
	},
	within: function(value) { // when an array of values is passed
		var lookup = {};
		for (var i in value) lookup[value[i]] = true;
		
		if (this._expression) this._expression.template = '%not(!!%operator[%term])';
		return this._oper(this._store(lookup));
	},
	has: function(value) {
		if (this._expression) this._expression.template = '%not(%term != null && %term.indexOf(%value) != -1)';
		return this._oper(null, value);
	},
	startsWith: function(value) {
		if (this._expression) this._expression.template = '%not(%term != null && %term.substr(0, %operator) == %value)';
		return this._oper(value.length, value);
	},
	endsWith: function(value) {
		if (this._expression) this._expression.template = '%not(%term != null && %term.substr(%term.length - %operator) == %value)';
		return this._oper(value.length, value);
	},
	gt: function(value) {
		return this._oper('>', value);
	},
	gte: function(value) {
		return this._oper('>=', value);
	},
	lt: function(value) {
		return this._oper('<', value);
	},
	lte: function(value) {
		return this._oper('<=', value);
	},
	regex: function(value) {
		if (this._expression) this._expression.template = '%not(%term != null && %operator.test(%term))';
		return this._oper(this._store(value));
	},
	same: function(value) {
		if (this._expression) this._expression.template = '%not(JSON.stringify(%term) %operator %value)';
		value = JSON.stringify(value);
		return this._oper('==', value);
	},
	filter: function(value) {
		if (type(value) != 'function') throw new Error('JaDE query.filter() parameter must be a function');
		if (this._expression) this._expression.template = '%not(%operator(%term))';
		else {
			this._expression = new Jade.expression();
			this._expression.template = '%not(%operator(obj))';
		}
		return this._oper(this._store(value));
	},
	type: function(value) {
		if (type(value) == 'function') {
			if (!this._expression) { // check the type of the main object
				this._expression = new Jade.expression();
				this._expression.template = '%not(obj instanceof %operator)';
			} else {
				this._expression.template = '%not(%term instanceof %operator)';
			}
			return this._oper(this._store(value));
		} else {
			if (this._expression) this._expression.template = '%not(type(%term) %operator %value)';
			return this._oper('==', value);
		}
	},
	search: function(value) {
		if (!value) {
			this._eval = this._eval.substring(0, this._eval.length - 4);
			return this;
		}
		if (!this._expression) this._expression = new Jade.expression();
		this._expression.template = '%not(%operator[getId(obj)])';
		return this._oper(this._store(value, true));
	},
	sort: function(field) {
		this._sorts.push(new Jade.sort(field));
		return this;
	},
	asc: function() {
		return this._sort(1);
	},
	desc: function() {
		return this._sort(-1);
	},
	regular: function() {
		return this._sort('regular');
	},
	numeric: function() {
		return this._sort('numeric');
	},
	date: function() {
		return this._sort('date');
	},
	custom: function(value) {
		return this._sort('custom', value);
	},
	limit: function(value) {
		this._limit = value;
		return this;
	},
	offset: function(value) {
		this._offset = value;
		return this;
	}
};

function propUpdate(updates) {
	return function(obj) {
		for (var i in updates) {
			if (updates.hasOwnProperty(i)) {
				obj[i] = updates[i];
			}
		}
	};
}

function type(value) {
	var type = typeof value;
	if (type == 'object') {
		if (value === null) type = 'null';
		else if (value instanceof Array) type = 'array';
	}
	return type;
}

var providedFilters = {
	is: function(prop, value) { // when just a string is passed
		return function(record) {
			return record[prop] == value;
		};
	},
	within: function(prop, value) { // when an array of values is passed
		var lookup = {};
		for (var i in value) lookup[value[i]] = true;
		return function(record) {
			return !!lookup[record[prop]];
		};
	},
	has: function(prop, value) {
		return function(record) {
			var v = record[prop];
			return v && v.length && v.indexOf(value) != -1;
		};
	},
	hasAll: function(prop, value) {
		return function(record) {
			var v = record[prop];
			if (!v || !v.length) return false;
			return value.every(function(obj) {
				return v.indexOf(obj) != -1;
			});
		};
	},
	startsWith: function(prop, value) {
		var length = value.length;
		return function(record) {
			return record[prop] && record[prop].substr(0, length) == value;
		};
	},
	endsWith: function(prop, value) {
		var length = value.length;
		return function(record) {
			var v = record[prop];
			return v && v.substr(v.length - length) == value;
		};
	},
	gt: function(prop, value) {
		var isDate = value instanceof Date;
		if (isDate) value = value.getTime();
		return function(record) {
			return record[prop] && (isDate ? record[prop].getTime() : record[prop]) > value;
		};
	},
	gte: function(prop, value) {
		var isDate = value instanceof Date;
		if (isDate) value = value.getTime();
		return function(record) {
			return record[prop] && (isDate ? record[prop].getTime() : record[prop]) >= value;
		};
	},
	lt: function(prop, value) {
		var isDate = value instanceof Date;
		if (isDate) value = value.getTime();
		return function(record) {
			return record[prop] && (isDate ? record[prop].getTime() : record[prop]) < value;
		};
	},
	lte: function(prop, value) {
		var isDate = value instanceof Date;
		if (isDate) value = value.getTime();
		return function(record) {
			return record[prop] && (isDate ? record[prop].getTime() : record[prop]) <= value;
		};
	},
	regex: function(prop, value) {
		return function(record) {
			return record[prop] && value.test(record[prop]);
		};
	},
	same: function(prop, value) {
		value = JSON.stringify(value);
		return function(record) {
			return JSON.stringify(record[prop]) == value;
		};
	},
	length: function(prop, value) {
		var i = 'is', filter;
		if (type(value) == 'object') {
			for (i in value) {
				filter = providedFilters[i]('length', value[i]);
				break;
			}
		} else {
			filter = providedFilters[i]('length', value);
		}
		return function(record) {
			return record[prop] ? filter(record[prop]) : false;
		};
	},
	type: function(prop, value) {
		if (type(value) == 'function') { // handle instanceof
			return function (record) {
				return record[prop] instanceof value;
			};
		} else {
			return function (record) {
				return type(record[prop]) == value;
			};
		}
	},
	// special object level filters
	_type: function(value) {
		return function (record) {
			return record instanceof value;
		};
	},
	_search: function(terms, index) {
		var hits = {};

		terms.forEach(function(term) {
			var regex = new RegExp(RegExp.escape(term)), chr = term.charAt(0), terms = index[chr];
			for (var i in terms) {
				if (!terms.hasOwnProperty(i)) continue;
				if (regex.test(i)) {
					var ids = terms[i];
					for (var id in ids) {
						if (ids.hasOwnProperty(id)) hits[id] = true;
					}
				}
			}
		});

		return function(record) {
			return !!hits[getId(record)];
		};
	}
};

var providedSorts = {
	regular: function(prop, order) {
		return function(a, b) {
			a = a[prop];
			b = b[prop];
			if (b == null) return -1;
			if (a == null) return 1;
			return order * (a > b ? 1 : (a < b ? -1 : 0));
		};
	},
	numeric: function(prop, order) {
		return function(a, b) {
			a = parseFloat(a[prop]);
			b = parseFloat(b[prop]);
			if (b == null || isNaN(b)) return -1;
			if (a == null || isNaN(a)) return 1;
			return order * (a - b);
		};
	},
	date: function(prop, order) {
		return function(a, b) {
			a = a[prop];
			b = b[prop];
			if (b == null) return -1;
			if (a == null) return 1;
			return order * (a.getTime() - b.getTime());
		};
	},
	custom: function(prop, func) {
		return function(a, b) {
			return func(a[prop], b[prop]);
		};
	}
};

var uuid = 0;

function getId(obj) {
	return obj.hasOwnProperty(defaultId) ? obj[defaultId] : (obj[defaultId] = ++uuid);
}

function isId(value) {
	return value != null && (typeof value == 'string' || typeof value == 'number');
}

//var stopWords = [ "a", "an", "and", "are", "as", "at", "be", "but", "by",
//	"for", "if", "in", "into", "is", "it", "no", "not", "of", "on", "or",
//	"s", "such", "t", "that", "the", "their", "they", "then", "there",
//	"these", "this", "to", "was", "will", "with" ];
//
//// stop words lookup
//var sw = {};
//for (var i = 0, l = stopWords.length; i < l; i++) {
//	sw[stopWords[i]] = true;
//}

RegExp.escape = function(text) {
	return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
};


})();


// ARRAY FUNCTIONS

(function() {

var proto = Array.prototype;
if (proto.forEach) return;

proto.forEach = function(fn, thisObj) {
	var scope = thisObj || window;
	for (var i = 0, j = this.length; i < j; ++i) {
		fn.call(scope, this[i], i, this);
	}
};
proto.every = function(fn, thisObj) {
	var scope = thisObj || window;
	for (var i = 0, j = this.length; i < j; ++i) {
		if (!fn.call(scope, this[i], i, this)) {
			return false;
		}
	}
	return true;
};
proto.some = function(fn, thisObj) {
	var scope = thisObj || window;
	for (var i = 0, j = this.length; i < j; ++i) {
		if (fn.call(scope, this[i], i, this)) {
			return true;
		}
	}
	return false;
};
proto.map = function(fn, thisObj) {
	var scope = thisObj || window;
	var a = [];
	for (var i = 0, j = this.length; i < j; ++i) {
		a.push(fn.call(scope, this[i], i, this));
	}
	return a;
};
proto.filter = function(fn, thisObj) {
	var scope = thisObj || window;
	var a = [];
	for (var i = 0, j = this.length; i < j; ++i) {
		if (fn.call(scope, this[i], i, this)) a.push(this[i]);
	}
	return a;
};
proto.indexOf = function(el, start) {
	start = start || 0;
	for (var i = start, j = this.length; i < j; ++i) {
		if (this[i] === el) {
			return i;
		}
	}
	return -1;
};
proto.lastIndexOf = function(el, start) {
	start = start !== undefined ? start : this.length;
	if (start >= this.length) {
		start = this.length;
	}
	if (start < 0) {
		start = this.length + start;
	}
	for (var i = start; i >= 0; --i) {
		if (this[i] === el) {
			return i;
		}
	}
	return -1;
};

})();

