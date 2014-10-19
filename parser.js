var Parser = require('jison').Parser

var grammar = {
	"lex": {
		"rules": [
			["\\s+", "/* skip whitespaces */"],
			["\\(", "return '(';"],
			["\\)", "return ')';"],
			["\\&", "return '&';"],
			["\\|", "return '|';"],
			["!=", "return '!=';"],
			["=", "return '=';"],
			["[a-zA-Z0-9\\-\\.]+", "return 'STRING';"],
			["$", "return 'EOF';"]
		]
	},

	"bnf": {
		"query" : [
			["logic EOF", "return $1"]
		], 
		"logic" : [
			["key_value", "$$ = $1"], 
			["logic binary_operator key_value", "$$ = { 'type' : 'binary_logic', 'operator' : $2, 'left' : $1, 'right' : $3}"]
		],
		"binary_operator" : [
			["&", "$$ = $1"], 
			["|", "$$ = $1"]
		],
		"key_value" : [
			["STRING equality STRING", "$$ = { 'type' : 'equality', 'operator' : $2, 'left' : $1, 'right' : $3}"],
			["( logic )", "$$ = $2"]
		],
		"equality" : [
			["=", "$$ = $1"], 
			["!=", "$$ = $1"]
		]
	}
}

var parser = new Parser(grammar)
var parserSource = parser.generate()

function evaluate(current_node, expression) {
	var type = current_node['type']
	if (type == 'binary_logic') {
		return evaluate_binary_logic(current_node, expression)
	} else if (type == 'equality') {
		return evaluate_equality_expression(current_node, expression)
	}
}

function evaluate_binary_logic(current_node, expression) {
	var operator = current_node['operator']
	var left = evaluate(current_node['left'], expression)
	var right = false
	if ((operator == '|' && left) || (operator == '&' && !left) ) {
		return left	
	}
	right = evaluate(current_node['right'], expression)
	if (operator == '|') {
		return left || right
	} else if (operator == '&') {
		return left && right
	}

}

function evaluate_equality_expression(current_node, expression) {
	var operator = current_node['operator']
	if (operator == '=') {
		return evaluate_equality(current_node, expression)
	} else if (operator == '!=') {
		return evaluate_inequality(current_node, expression)
	} else {
		console.error("Error!")
	}
}

function evaluate_inequality(current_node, expression) {
	var key = current_node['left']
	var value = current_node['right']
	if (expression[key] != null) {
		return expression[key] != value
	} else {
		return true
	}
}

function evaluate_equality(current_node, expression) {
	var key = current_node['left']
	var value = current_node['right']
	if (expression[key] != null) {
		return expression[key] == value
	} else {
		return false
	}
}


/*
* test
**/

var instances = [
	{
		'instance-id' : 'i-12334',
		'ip' : '127.0.0.1',
		'ami-id' : 'ubuntu-14.04-kernel'
	},
	{
		'instance-id' : 'i-66666',
		'ip' : '54.54.0.1',
		'ami-id' : 'ubuntu-12.10-kernel'
	},
]

var sample_query = '(instance-id = i-32333 & ip = 127.0.0.1) | (ip = 54.54.0.1 & ami-id = ubuntu-12.10-kernel)'

try {
	var result = parser.parse(sample_query)
} catch (err) {
	console.error(err.message)
	throw err
}

for (var instance in instances) {
	if (evaluate(result, instances[instance]) == true) {
		console.log(instances[instance])
	}
}

