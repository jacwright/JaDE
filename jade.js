var JaDE;

(function() {

JaDE = function(storageBucket) {
	this._store = [];
	this._lookup = {};
	this._bucket = storageBucket;

	// this data should be loaded from and stored into localStorage by this key
	if (storageBucket && typeof localStorage != 'undefined') {
		this.restore();
		var self = this;
		var flush = function() {
			self.flush(true);
		};

		if (window.attachEvent) window.attachEvent('onunload', flush);
		else window.addEventListener('unload', flush, false);
	}
}

JaDE.prototype = {

	/**
	 * Returns an array of records which match the provided filters, or all the records if no filters are specified. The
	 * second parameter may be provided as the source for the record search.
	 *
	 * @param filters An object of {property: filter} format or a filter function.
	 * @param [records] An optional array of object to search. If not provided will use all records in the database.
	 */
	get: function(filters, records) {
		return this._filter(records || this._store, filters);
	},

	first: function(filters, records) {
		return this.get(filters, records)[0];
	},

	add: function(obj) {
		if (type(obj) == 'array') {
			var self = this;
			return obj.map(function(obj) {
				return self.add(obj);
			});
		}

		var id = this._getId(obj);
		if (this._lookup[id]) return 0;
		if (this.onAdd) this.onAdd(obj);
		this._store.push(obj);
		this._indexObj(obj);
		this._lookup[id] = obj;
		return id;
	},

	update: function(updates, filters) {
		var records = this._filter(this._store, filters);
		if (this.onUpdate) {
			records.forEach(function(obj) {
				this.onUpdate(updates, obj);
			});
		}
		records.forEach(type(updates) == 'function' ? updates : propUpdate);
		return records.length;
	},

	remove: function(filters) {
		var records = this._store, removed = {}, lookup = this._lookup, onRemove = this.onRemove;
		records = this._filter(records, filters);

		records.forEach(function(obj) {
			if (onRemove) onRemove(obj);
			var id = this._getId(obj);
			delete lookup[id];
			removed[id] = true;
			this._unindexObj(obj);
		});

		this._store = this._store.filter(function(obj) {
			return !removed[this._getId(obj)];
		});

		this._store = records;
		return records.length;
	},
	
	id: function(field) {
		this._idField = field || null;
	},

	/**
	 * Sets a group of fields to be included in a full-text index.
	 * @param fields An array of fields to be indexed.
	 */
	index: function(fields) {
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

	flush: function(clean) {
		if (this._bucket && typeof localStorage != 'undefined') {
			var data = this._store;
			if (clean) {
				data.forEach(function(obj) {
					delete obj._id;
				});
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
				
				// don't let stored _id fields conflict with the live counter
				this._store.forEach(function(obj) {
					obj._id = ++uuid;
					this._indexObj(obj);
				});
			}
		}
	},

	onAdd: null, // function(obj) {},

	onUpdate: null, // function(updates, obj) {},

	onRemove: null, // function(obj) {}

	
	_getId: function(obj) {
		return this._idField ? obj[this._idField] : getId(obj);
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

	_unindexObj: function(obj) {
		if (!this._index) return;
		var id = this._getId(obj), index = this._index;
		for (var char in index) {
			if (!index.hasOwnProperty(char)) continue;
			var letter = index[char];
			for (var i in letter) {
				if (!letter.hasOwnProperty(i)) continue;
				delete letter[i][id];
			}
		}
	},

	_hit: function(term, id) {
		var char = term.charAt(0);
		var letter = this._index[char] || (this._index[char] = {});
		var hits = letter[term] || (letter[term] = {});
		hits[id] = true;
	},
	
	_getAllTerms: function(obj) {
		var terms = [], getTerms = this._getTerms;
		
		this._indexFields.forEach(function(field) {
			if (!obj.hasOwnProperty(field)) return;
			var value = obj[field];
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
			if (!sw[token]) terms.push(token); // with custom punctuation (e.g. @twitter, #search, (parenthesis))
			if (!isQuery) {
				var word = token.replace(/^\W+|\W+$/g, ''); // without custom punctuation
				if (word != token) terms.push(word);
			}
		}
		return terms;
	},
	
	/**
	 * Filters the provided set of records with the provided filters. If no filters are given the records are returned.
	 *
	 * @param records An array of records to search.
	 * @param filters A function or object with filters.
	 */
	_filter: function(records, filters) {
		if (!filters) return records;

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
				records.length = limit;
			}
		}

		return records;
	}
};


function propUpdate(updates) {
	return function(obj) {
		for (var i in updates) {
			obj[i] = updates[i];
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
	starts: function(prop, value) {
		var length = value.length;
		return function(record) {
			return record[prop] && record[prop].substr(0, length) == value;
		};
	},
	ends: function(prop, value) {
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
			var regex = new RegExp(RegExp.escape(term)), char = term.charAt(0), terms = index[char];
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
	return obj.hasOwnProperty('_id') ? obj._id : (obj._id = ++uuid);
}

var stopWords = [ "a", "an", "and", "are", "as", "at", "be", "but", "by",
	"for", "if", "in", "into", "is", "it", "no", "not", "of", "on", "or",
	"s", "such", "t", "that", "the", "their", "they", "then", "there",
	"these", "this", "to", "was", "will", "with" ];

// stop words lookup
var sw = {};
for (var i = 0, l = stopWords.length; i < l; i++) {
	sw[stopWords[i]] = true;
}

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

