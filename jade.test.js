
TestCase('JaDETest', {
	
	setUp: function() {
		this.db = new Jade();
	},
	
	tearDown: function() {
		
	},
	
	testAdd: function() {
		this.db.add({name: "Jade"});
		assertEquals('Jade.add not adding single items', 1, this.db._store.length);
		
		this.db._store.length = 0;
		this.db.add([ {name: "Jade"}, {name: "Jade"} ]);
		assertEquals('Jade.add not adding multiple items', 2, this.db._store.length);
	},
	
	testQuery: function() {
		var query = Jade.query('name').is('John');
		assertEquals('Jade.query "is" incorrect', '(obj.name == "John")', query.toString());
		
		query = Jade.query('firstName').is('John').and('lastName').is('Anderson');
		assertEquals('Jade.query "and" incorrect', '(obj.firstName == "John") && (obj.lastName == "Anderson")', query.toString());
		
		query = Jade.query('firstName').is('John').or('lastName').is('Anderson');
		assertEquals('Jade.query "or" incorrect', '(obj.firstName == "John") || (obj.lastName == "Anderson")', query.toString());
		
		query = Jade.query('firstName').is('John').and(Jade.query('lastName').is(null).or('lastName').is('Anderson'));
		assertEquals('Jade.query "subquery" incorrect', '(obj.firstName == "John") && ((obj.lastName == null) || (obj.lastName == "Anderson"))', query.toString());
		
		query = Jade.query('firstName').gte('John');
		assertEquals('Jade.query "gte" incorrect', '(obj.firstName >= "John")', query.toString());
		
		query = Jade.query('tags.length').gt(0);
		assertEquals('Jade.query deep terms incorrect', '(obj.tags.length > 0)', query.toString());
	},
	
	testGet: function() {
		var bob1 = { firstName: 'Bob', lastName: 'Jones' };
		var bob2 = { firstName: 'Bob', lastName: 'Anderson' };
		var fred = { firstName: 'Fred', lastName: 'Wilson' };
		
		this.db.add([ bob1, fred, bob2 ]);
		
		var result = this.db.get({firstName: 'Bob'});
		assertEquals('Jade.get did not return correct basic matches', [bob1, bob2], result);
		
		result = this.db.get({firstName: 'Fred', lastName: 'Wilson'});
		assertEquals('Jade.get did not return correct number of basic matches', [fred], result);
		
		result = this.db.get(q('firstName').is('Bob'));
		assertEquals('Jade.get query did not return correct basic matches', [bob1, bob2], result);
		
		result = this.db.get(q('firstName').is('Fred').and('lastName').is('Wilson'));
		assertEquals('Jade.get query did not return correct basic matches', [fred], result);
	},
	
	testFirst: function() {
		var bob1 = { firstName: 'Bob', lastName: 'Jones' };
		var bob2 = { firstName: 'Bob', lastName: 'Anderson' };
		var fred = { firstName: 'Fred', lastName: 'Wilson' };
		
		this.db.add([ bob1, fred, bob2 ]);
		
		assertEquals('Jade.first did not return the correct result', bob1, this.db.first());
	},
	
	testHas: function() {
		var one = { tags: ['one', 'two', 'three'] };
		var two = { tags: ['three', 'four', 'five'] };
		var three = { tags: ['one', 'six', 'eight'] };
		
		this.db.add([one, two, three]);
		
		var results = this.db.get({
			tags: {has: 'one'}
		});
		
		assertEquals('Jade.get has filter incorrect', [one, three], results);
		
		assertEquals('Jade.get has filter incorrect', [one, three], this.db.get(q('tags').has('one')));
	},
	
	testHasAll: function() {
		var one = { tags: ['one', 'two', 'three'] };
		var two = { tags: ['three', 'four', 'five'] };
		var three = { tags: ['one', 'six', 'eight'] };
		
		this.db.add([one, two, three]);
		
		var results = this.db.get({
			tags: {hasAll: ['one', 'two']}
		});
		
		assertEquals('Jade.get hasAll filter incorrect', [one], results);
	},
	
	testStartsAndEnds: function() {
		var bob1 = { firstName: 'Bobby', lastName: 'Jones' };
		var bob2 = { firstName: 'Bob', lastName: 'Anderson' };
		var fred = { firstName: 'Fred', lastName: 'Wilson' };
		
		this.db.add([ bob1, fred, bob2 ]);
		
		var results = this.db.get({
			firstName: {startsWith: 'Bob'}
		});
		
		assertEquals('Jade.get starts filter incorrect', [bob1, bob2], results);
		
		assertEquals('Jade.get starts filter incorrect', [bob1, bob2], this.db.get(q('firstName').startsWith('Bob')));
		
		results = this.db.get({
			lastName: {endsWith: 'son'}
		});
		
		assertEquals('Jade.get ends filter incorrect', [fred, bob2], results);
		
		assertEquals('Jade.get ends filter incorrect', [fred, bob2], this.db.get(q('lastName').endsWith('son')));
	},
	
	testGreaterThan: function() {
		var bob1 = { firstName: 'Bobby', lastName: 'Jones', age: 20 };
		var bob2 = { firstName: 'Bob', lastName: 'Anderson', age: 28 };
		var fred = { firstName: 'Fred', lastName: 'Wilson', age: 36 };
		
		this.db.add([ bob1, fred, bob2 ]);
		
		var results = this.db.get({ age: {gt: 20} });
		assertEquals('Jade.get gt filter incorrect', [fred, bob2], results);
		
		assertEquals('Jade.get gt filter incorrect', [fred, bob2], this.db.get(q('age').gt(20)));
		
		results = this.db.get({ age: {gte: 28} });
		assertEquals('Jade.get gte filter incorrect', [fred, bob2], results);
		
		assertEquals('Jade.get gte filter incorrect', [fred, bob2], this.db.get(q('age').gte(28)));
	},
	
	testLessThan: function() {
		var bob1 = { firstName: 'Bobby', lastName: 'Jones', age: 20 };
		var bob2 = { firstName: 'Bob', lastName: 'Anderson', age: 28 };
		var fred = { firstName: 'Fred', lastName: 'Wilson', age: 36 };
		
		this.db.add([ bob1, fred, bob2 ]);
		
		var results = this.db.get({ age: {lt: 28} });
		assertEquals('Jade.get lt filter incorrect', [bob1], results);
		
		assertEquals('Jade.get lt filter incorrect', [bob1], this.db.get(q('age').lt(28)));
		
		results = this.db.get({ age: {lte: 28} });
		assertEquals('Jade.get lte filter incorrect', [bob1, bob2], results);
		
		assertEquals('Jade.get lte filter incorrect', [bob1, bob2], this.db.get(q('age').lte(28)));
	},
	
	testRegex: function() {
		var bob1 = { firstName: 'Bobby', lastName: 'Jones', age: 20 };
		var bob2 = { firstName: 'Bob', lastName: 'Anderson', age: 28 };
		var fred = { firstName: 'Fred', lastName: 'Wilson', age: 36 };
		
		this.db.add([ bob1, fred, bob2 ]);
		
		var results = this.db.get({ firstName: /^B/ });
		assertEquals('Jade.get regex filter incorrect', [bob1, bob2], results);
		assertEquals('Jade.get regex filter incorrect', [bob1, bob2], this.db.get(q('firstName').regex(/^B/)));
		
		results = this.db.get({ lastName: {regex: /^\w+$/} });
		assertEquals('Jade.get regex filter incorrect', [bob1, fred, bob2], results);
		assertEquals('Jade.get regex filter incorrect', [bob1, fred, bob2], this.db.get(q('lastName').regex(/^\w+$/)));
	},
	
	testSame: function() {
		var bob1 = { firstName: 'Bobby', lastName: 'Jones', pet: {type: 'dog'} };
		var bob2 = { firstName: 'Bob', lastName: 'Anderson', pet: {type: 'cat'} };
		var fred = { firstName: 'Fred', lastName: 'Wilson', pet: {type: 'parrot'} };
		
		this.db.add([ bob1, fred, bob2 ]);
		
		var results = this.db.get({ pet: { same: {type: 'dog'} } });
		assertEquals('Jade.get same filter incorrect', [bob1], results);
		assertEquals('Jade.get same filter incorrect', [bob1], this.db.get(q('pet').same({type: 'dog'})));
	},
	
	testLength: function() {
		var bob1 = { firstName: 'Bobby', lastName: 'Jones', pets: ['dog'] };
		var bob2 = { firstName: 'Bob', lastName: 'Anderson', pets: ['dog', 'cat'] };
		var fred = { firstName: 'Fred', lastName: 'Wilson', pets: ['dog', 'cat', 'parrot'] };
		
		this.db.add([ bob1, fred, bob2 ]);
		
		var results = this.db.get({ pets: { length: 2 } });
		assertEquals('Jade.get length filter incorrect', [bob2], results);
		assertEquals('Jade.get length filter incorrect', [bob2], this.db.get(q('pets.length').is(2)));
		
		results = this.db.get({ pets: { length: {gte: 2} } });
		assertEquals('Jade.get length with object filter incorrect', [fred, bob2], results);
		assertEquals('Jade.get length with object filter incorrect', [fred, bob2], this.db.get(q('pets.length').gte(2)));
	},
	
	testSearch: function() {
		var one = { text: 'Does Sally like Bob?', title: 'The Best Part' };
		var two = { text: 'What did #bobby do last week?', title: 'Will Apple Win?' };
		var three = { text: 'Find out how to get your teeth whitened', title: 'White Teeth' };
		
		this.db.index('text, title');
		this.db.add([ one, two, three ]);
		
		var results = this.db.get('bob');
		assertEquals('Jade.get search incorrect', [one, two], results);
		assertEquals('Jade.get search incorrect', [one, two], this.db.get(q().search('bob')));
		
		var results = this.db.get('#bob');
		assertEquals('Jade.get search incorrect', [two], results);
		assertEquals('Jade.get search incorrect', [two], this.db.get(q().search('#bob')));
		
		results = this.db.get({ _search: 'teeth' });
		assertEquals('Jade.get _search incorrect', [three], results);
		assertEquals('Jade.get _search incorrect', [three], this.db.get(q().search('teeth')));
	},
	
	testSort: function() {
		var bob1 = { firstName: 'Bob', lastName: 'Jones', age: 20 };
		var bob2 = { firstName: 'Bob', lastName: 'Anderson', age: 28 };
		var fred = { firstName: 'Fred', lastName: 'Wilson', age: 36 };
		
		this.db.add([ bob1, fred, bob2 ]);
		
		var results = this.db.get({ _sort: 'lastName' });
		assertEquals('Jade.get default sort incorrect', [bob2, bob1, fred], results);
		assertEquals('Jade.get default sort incorrect', [bob2, bob1, fred], this.db.get(q().sort('lastName')));
		
		results = this.db.get({ _sort: 'lastName desc' });
		assertEquals('Jade.get default sort incorrect', [fred, bob1, bob2], results);
		assertEquals('Jade.get default sort incorrect', [fred, bob1, bob2], this.db.get(q().sort('lastName').desc()));
		
		results = this.db.get({ _sort: { firstName: 'regular', age: 'numeric desc' } });
		assertEquals('Jade.get sorts incorrect', [bob2, bob1, fred], results);
		assertEquals('Jade.get sorts incorrect', [bob2, bob1, fred], this.db.get(q().sort('firstName').sort('age').numeric().desc()));
	},
	
	testLimit: function() {
		
		var one = {int: 1}, two = {int: 2}, three = {int: 3}, four = {int: 4}, five = {int: 5};
		this.db.add([ one, two, three, four, five ]);
		var results = this.db.get({
			_sort: 'int desc',
			_limit: 3
		});
		assertEquals('Jade.get limit incorrect', [five, four, three], results);
		assertEquals('Jade.get limit incorrect', [five, four, three], this.db.get(q().sort('int').desc().limit(3)));
	}
	
});
