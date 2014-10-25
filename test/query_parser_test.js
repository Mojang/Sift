var should = require('should')

var instance_1 = {
    'name' : 'McoController - PRODUCTION',
    'id' : 'i-12334',
    'ip' : '127.0.0.1',
    'image' : 'ubuntu-14.04-kernel',
    'tag.type' : 'McoController',
    'tag.environment' : 'PRODUCTION'
}

var instance_2 = {
	'name' : 'PeoController - PRODUCTION',
	'id' : 'i-66666',
	'ip' : '54.54.0.1',
	'image' : 'ubuntu-12.10-kernel',
	'tag.type' : 'PeoController',
	'tag.environment' : 'PRODUCTION'
}


var instances = [ instance_1, instance_2]
	
var parser = require('../query_parser.js')	

var match = function (ast) {
	return instances.filter(function (cur) {
	  return parser.match_sync(cur, ast)
	})
}

var is_the_same = function (element, index, array) {
	return JSON.stringify(element) === JSON.stringify(array[0])	
}

describe('Query Parser', function () {
	
	it('generates an object of the query', function (done) {
		var query = 'id contains i-'
		var ast = parser.generate_query_ast_sync(query)
		ast.should.be.Object
		done()
	})

	it('accepts different variation of (AND)', function (done) {
		var v1 = '(id contains i-) and (ip = 127)'
		var v2 = '(id contains i-) AND (ip = 127)'
		var v3 = '(id contains i-) And (ip = 127)'
		var v4 = '(id contains i-) & (ip = 127)'
		var v5 = '(id contains i-) && (ip = 127)'
		var list = [v1, v2, v3, v4, v5].map(function (el) { return parser.generate_query_ast_sync(el) })
		list.every(is_the_same).should.be.true
		done()
	})

	it('accepts different variation of (OR)', function (done) {
		var v1 = '(id contains i-) or (ip = 127)'
		var v2 = '(id contains i-) OR (ip = 127)'
		var v3 = '(id contains i-) Or (ip = 127)'
		var v4 = '(id contains i-) | (ip = 127)'
		var v5 = '(id contains i-) || (ip = 127)'
		var list = [v1, v2, v3, v4, v5].map(function (el) { return parser.generate_query_ast_sync(el) })
		list.every(is_the_same).should.be.true
		done()
	})

	it('accepts different variation of (NOT)', function (done) {
		var v1 = 'not (id contains i-)'
		var v2 = 'Not (id contains i-)'
		var v3 = 'NOT (id contains i-)'
		var v4 = '! (id contains i-)'
		var v5 = '~ (id contains i-)'
		var list = [v1, v2, v3, v4, v5].map(function (el) { return parser.generate_query_ast_sync(el) })
		list.every(is_the_same).should.be.true
		done()
	})

	it('accepts different variations of (=)', function (done) {
		var v1 = '(id = i-)'
		var v2 = '(id == i-)'
		var list = [v1, v2].map(function (el) { return parser.generate_query_ast_sync(el) })
		list.every(is_the_same).should.be.true
		done()
	})

	it('accepts different variations of (!=)', function (done) {
		var v1 = '(id != i-)'
		var v2 = '(id <> i-)'
		var list = [v1, v2].map(function (el) { return parser.generate_query_ast_sync(el) })
		list.every(is_the_same).should.be.true
		done()
	})

	it('accepts different variations of (contains)', function (done) {
		var v1 = '(id contains i-)'
		var v2 = '(id Contains i-)'
		var v3 = '(id CONTAINS i-)'
		var list = [v1, v2, v3	].map(function (el) { return parser.generate_query_ast_sync(el) })
		list.every(is_the_same).should.be.true
		done()
	})

	it('accepts binary logic', function (done) {
		var query = '(id contains i-) and (ip contains 127)'
		var ast = parser.generate_query_ast_sync(query)
		var result = match(ast)
		result.should.be.Array
		result.should.have.lengthOf(1)
		result[0].should.eql(instance_1)
		done()
	})

	it('accepts unary logic', function (done) {
		var query = '(not id contains i-) and (not ip contains 127)'
		var ast = parser.generate_query_ast_sync(query)
		var result = match(ast)
		result.should.be.Array
		result.should.have.lengthOf(0)
		done()
	})

	it('accepts combined statements', function (done) {
		var query = '((not id contains i-) and (not ip contains 127)) or (image contains ubun and tag.type = PeoController)'
		var ast = parser.generate_query_ast_sync(query)
		var result = match(ast)
		result.should.be.Array
		result.should.have.lengthOf(1)
		result[0].should.eql(instance_2)
		done()
	})

	it('does not accept broken query', function (done) {
		var query = '((not id contains i-) and (not ip contains 127)) or image contains ubun and tag.type = PeoController)'
		var ast = null
		try {
			ast = parser.generate_query_ast_sync(query)
		} catch (err) {
			ast = err
		}
		ast.should.be.Error
		done()
	})

	it('accepts statements with valid redundant parantheses', function (done) {
		var query = '(((not id contains i-)))'
		var ast = parser.generate_query_ast_sync(query)
		var result = match(ast)
		result.should.be.Array
		result.should.have.lengthOf(0)
		done()
	})

	it('accepts statements whose value has whitespace in it', function (done) {
		var query = 'name contains \'Controller - \''
		var ast = parser.generate_query_ast_sync(query)
		var result = match(ast)
		result.should.be.Array
		result.should.have.lengthOf(2)
		done()
	})
})