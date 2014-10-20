var Parser = require('jison').Parser

var grammar = {
  "lex": {
    "rules": [
      ["\\s+", "/* skip whitespaces */"],
      ["\\(", "return '(';"],
      ["\\)", "return ')';"],
      ["\\&", "return '&';"],
      ["and", "return 'and';"],
      ["And", "return 'And';"],
      ["AND", "return 'AND';"],
      ["\\|", "return '|';"],
      ["or", "return 'or';"],
      ["Or", "return 'Or';"],
      ["OR", "return 'OR';"],
      ["!=", "return '!=';"],
      ["<>", "return '<>';"],
      ["=", "return '=';"],
      ["like", "return 'like';"],
      ["Like", "return 'Like';"],
      ["LIKE", "return 'LIKE';"],
      ["[a-zA-Z0-9\\-\\.\\?\\*]+", "return 'STRING';"],
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
      ["&", "$$ = '&'"],
      ["and", "$$ = '&'"], 
      ["And", "$$ = '&'"], 
      ["AND", "$$ = '&'"], 
      ["|", "$$ = '|'"],
      ["or", "$$ = '|'"],
      ["Or", "$$ = '|'"],
      ["OR", "$$ = '|'"]
    ],
    "key_value" : [
      ["STRING equality STRING", "$$ = { 'type' : 'equality', 'operator' : $2, 'left' : $1, 'right' : $3}"],
      ["( logic )", "$$ = $2"]
    ],
    "equality" : [
      ["=", "$$ = '='"], 
      ["<>", "$$ = '!='"], 
      ["!=", "$$ = '!='"],
      ["like", "$$ = $1"],
      ["Like", "$$ = $1"],
      ["LIKE", "$$ = $1"]
    ]
  }
}

var parser = new Parser(grammar)

module.exports = { 
  match: function (json_object, query_ast, callback) {
    if (json_object.account != null) {
      delete json_object.account
    }
    try {
      callback(null, evaluate(query_ast, json_object))
    } catch (err) {
      console.trace(err)
      callback(err)
    }
  },

  generate_query_ast: function (query, callback) {
    try {
      callback(null, parser.parse(query))
    } catch (err) {
      callback(err)
    }
  },

  generate_query_ast_sync: function (query) {
    return parser.parse(query)
  }

}


var evaluate = function (current_ast_node, expression) {
  var type = current_ast_node['type']
  if (type == 'binary_logic') {
    return evaluate_binary_logic(current_ast_node, expression)
  } else if (type == 'equality') {
    return evaluate_equality_expression(current_ast_node, expression)
  }
}

var evaluate_binary_logic = function (current_ast_node, expression) {
  var operator = current_ast_node['operator']
  var left = evaluate(current_ast_node['left'], expression)
  var right = false
  if ((operator == '|' && left) || (operator == '&' && !left)) {
    return left 
  }
  right = evaluate(current_ast_node['right'], expression)
  if (operator == '|') {
    return left || right
  } else if (operator == '&') {
    return left && right
  }
}

var evaluate_equality_expression = function (current_ast_node, expression) {
  var operator = current_ast_node['operator']
  if (operator == '=') {
    return evaluate_equality(current_ast_node, expression)
  } else if (operator == '!=') {
    return evaluate_inequality(current_ast_node, expression)
  } else if (operator.toLowerCase() == 'like') {
    return evaluate_like(current_ast_node, expression)
  }
}

var evaluate_inequality = function (current_ast_node, expression) {
  var key = current_ast_node['left'].toLowerCase()
  var value = (typeof current_ast_node['right'] === String ? current_ast_node['right'].toLowerCase() : current_ast_node['right'])
  if (expression[key] != null) {
    return (typeof expression[key] === String ? (expression[key].toLowerCase() != value) : (expression[key] != value))
  } else {
    return true
  }
}

var evaluate_equality = function (current_ast_node, expression) {
  var key = current_ast_node['left'].toLowerCase()
  var value = (typeof current_ast_node['right'] === String ? current_ast_node['right'].toLowerCase() : current_ast_node['right'])
  if (expression[key] != null) {
    return (typeof expression[key] === String ? (expression[key].toLowerCase() == value) : (expression[key] == value))
  } else {
    return false
  }
}

var evaluate_like = function (current_ast_node, expression) {
  var key = current_ast_node['left'].toLowerCase()
  var value = (typeof current_ast_node['right'] === String ? current_ast_node['right'].toLowerCase() : current_ast_node['right'])
  if (expression[key] != null) {
    return (typeof expression[key] === String ? (expression[key].toLowerCase().indexOf(value) > -1) : (expression[key].indexOf(value) > -1))
  } else {
    return false
  }
}