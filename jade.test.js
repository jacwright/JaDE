
TestCase('JaDETest', {
	
	setUp: function() {
		this.db = new JaDE();
	},
	
	tearDown: function() {
		
	},
	
	testAdd: function() {
		this.db.add({name: "JaDE"});
		assertEquals('JaDE.add not adding single items', 1, this.db._store.length);
		
		this.db._store.length = 0;
		this.db.add([ {name: "JaDE"}, {name: "JaDE"} ]);
		assertEquals('JaDE.add not adding multiple items', 2, this.db._store.length);
	},
	
	testGet: function() {
		var bob1 = { firstName: 'Bob', lastName: 'Jones' };
		var bob2 = { firstName: 'Bob', lastName: 'Anderson' };
		var fred = { firstName: 'Fred', lastName: 'Wilson' };
		
		this.db.add([ bob1, fred, bob2 ]);
		
		var result = this.db.get({firstName: 'Bob'});
		
		assertEquals('JaDE.get did not return correct number of basic matches', 2, result.length);
		assertTrue('JaDE.get did not return correct basic matches', result.indexOf(bob1) != -1 && result.indexOf(bob2) != -1);
		
		result = this.db.get({firstName: 'Fred', lastName: 'Wilson'});
		assertEquals('JaDE.get did not return correct number of basic matches', 1, result.length);
		assertEquals('JaDE.get did not return correct number of basic matches', fred, result[0]);
	},
	
	testFirst: function() {
		var bob1 = { firstName: 'Bob', lastName: 'Jones' };
		var bob2 = { firstName: 'Bob', lastName: 'Anderson' };
		var fred = { firstName: 'Fred', lastName: 'Wilson' };
		
		this.db.add([ bob1, fred, bob2 ]);
		
		assertEquals('JaDE.first did not return the correct result', bob1, this.db.first());
	},
	
	testHas: function() {
		var one = { tags: ['one', 'two', 'three'] };
		var two = { tags: ['three', 'four', 'five'] };
		var three = { tags: ['one', 'six', 'eight'] };
		
		this.db.add([one, two, three]);
		
		var results = this.db.get({
			tags: {has: 'one'}
		});
		
		assertEquals('JaDE.get has filter incorrect', [one, three], results);
	},
	
	testHasAll: function() {
		var one = { tags: ['one', 'two', 'three'] };
		var two = { tags: ['three', 'four', 'five'] };
		var three = { tags: ['one', 'six', 'eight'] };
		
		this.db.add([one, two, three]);
		
		var results = this.db.get({
			tags: {hasAll: ['one', 'two']}
		});
		
		assertEquals('JaDE.get hasAll filter incorrect', [one], results);
	},
	
	testStartsAndEnds: function() {
		var bob1 = { firstName: 'Bobby', lastName: 'Jones' };
		var bob2 = { firstName: 'Bob', lastName: 'Anderson' };
		var fred = { firstName: 'Fred', lastName: 'Wilson' };
		
		this.db.add([ bob1, fred, bob2 ]);
		
		var results = this.db.get({
			firstName: {starts: 'Bob'}
		});
		
		assertEquals('JaDE.get starts filter incorrect', [bob1, bob2], results);
		
		results = this.db.get({
			lastName: {ends: 'son'}
		});
		
		assertEquals('JaDE.get ends filter incorrect', [fred, bob2], results);
	},
	
	testGreaterThan: function() {
		var bob1 = { firstName: 'Bobby', lastName: 'Jones', age: 20 };
		var bob2 = { firstName: 'Bob', lastName: 'Anderson', age: 28 };
		var fred = { firstName: 'Fred', lastName: 'Wilson', age: 36 };
		
		this.db.add([ bob1, fred, bob2 ]);
		
		var results = this.db.get({ age: {gt: 20} });
		assertEquals('JaDE.get gt filter incorrect', [fred, bob2], results);
		
		results = this.db.get({ age: {gte: 28} });
		assertEquals('JaDE.get gte filter incorrect', [fred, bob2], results);
	},
	
	testLessThan: function() {
		var bob1 = { firstName: 'Bobby', lastName: 'Jones', age: 20 };
		var bob2 = { firstName: 'Bob', lastName: 'Anderson', age: 28 };
		var fred = { firstName: 'Fred', lastName: 'Wilson', age: 36 };
		
		this.db.add([ bob1, fred, bob2 ]);
		
		var results = this.db.get({ age: {lt: 28} });
		assertEquals('JaDE.get lt filter incorrect', [bob1], results);
		
		results = this.db.get({ age: {lte: 28} });
		assertEquals('JaDE.get lte filter incorrect', [bob1, bob2], results);
	},
	
	testRegex: function() {
		var bob1 = { firstName: 'Bobby', lastName: 'Jones', age: 20 };
		var bob2 = { firstName: 'Bob', lastName: 'Anderson', age: 28 };
		var fred = { firstName: 'Fred', lastName: 'Wilson', age: 36 };
		
		this.db.add([ bob1, fred, bob2 ]);
		
		var results = this.db.get({ firstName: /^B/ });
		assertEquals('JaDE.get regex filter incorrect', [bob1, bob2], results);
		
		results = this.db.get({ lastName: {regex: /^\w+$/} });
		assertEquals('JaDE.get regex filter incorrect', [bob1, fred, bob2], results);
	},
	
	testSame: function() {
		var bob1 = { firstName: 'Bobby', lastName: 'Jones', pet: {type: 'dog'} };
		var bob2 = { firstName: 'Bob', lastName: 'Anderson', pet: {type: 'cat'} };
		var fred = { firstName: 'Fred', lastName: 'Wilson', pet: {type: 'parrot'} };
		
		this.db.add([ bob1, fred, bob2 ]);
		
		var results = this.db.get({ pet: { same: {type: 'dog'} } });
		assertEquals('JaDE.get same filter incorrect', [bob1], results);
	},
	
	testLength: function() {
		var bob1 = { firstName: 'Bobby', lastName: 'Jones', pets: ['dog'] };
		var bob2 = { firstName: 'Bob', lastName: 'Anderson', pets: ['dog', 'cat'] };
		var fred = { firstName: 'Fred', lastName: 'Wilson', pets: ['dog', 'cat', 'parrot'] };
		
		this.db.add([ bob1, fred, bob2 ]);
		
		var results = this.db.get({ pets: { length: 2 } });
		assertEquals('JaDE.get length filter incorrect', [bob2], results);
		
		results = this.db.get({ pets: { length: {gte: 2} } });
		assertEquals('JaDE.get length with object filter incorrect', [fred, bob2], results);
	},
	
	testSearch: function() {
		var one = { text: 'Does Sally like Bob?', title: 'The Best Part' };
		var two = { text: 'What did #bobby do last week?', title: 'Will Apple Win?' };
		var three = { text: 'Find out how to get your teeth whitened', title: 'White Teeth' };
		
		this.db.index('text, title');
		this.db.add([ one, two, three ]);
		
		var results = this.db.get('bob');
		assertEquals('JaDE.get search incorrect', [one, two], results);
		
		var results = this.db.get('#bob');
		assertEquals('JaDE.get search incorrect', [two], results);
		
		results = this.db.get({ _search: 'teeth' });
		assertEquals('JaDE.get _search incorrect', [three], results);
	},
	
	testSort: function() {
		var bob1 = { firstName: 'Bob', lastName: 'Jones', age: 20 };
		var bob2 = { firstName: 'Bob', lastName: 'Anderson', age: 28 };
		var fred = { firstName: 'Fred', lastName: 'Wilson', age: 36 };
		
		this.db.add([ bob1, fred, bob2 ]);
		
		var results = this.db.get({ _sort: 'lastName' });
		assertEquals('JaDE.get default sort incorrect', [bob2, bob1, fred], results);
		
		results = this.db.get({ _sort: 'lastName desc' });
		assertEquals('JaDE.get default sort incorrect', [fred, bob1, bob2], results);
		
		results = this.db.get({ _sort: { firstName: 'regular', age: 'numeric desc' } });
		assertEquals('JaDE.get sorts incorrect', [bob2, bob1, fred], results);
	},
	
	testLimit: function() {
		
		var one = {int: 1}, two = {int: 2}, three = {int: 3}, four = {int: 4}, five = {int: 5};
		this.db.add([ one, two, three, four, five ]);
		var results = this.db.get({
			_sort: 'int desc',
			_limit: 3
		});
		assertEquals('JaDE.get limit incorrect', [five, four, three], results);
	}
	
});
