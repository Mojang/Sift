var Parser = require('jison').Parser

var grammar = {
  "lex": {
    "rules": [
      ["\\s+", "/* skip whitespaces */"],
      ["\\(", "return '(';"],
      ["\\)", "return ')';"],
      ["!=|<>", "return '!=';"],
      ["\\&\\&|and|And|AND|\\&", "return 'and';"],
      ["\\|\\||or|OR|Or|\\|", "return 'or';"],
      ["not|NOT|Not|\\!|\\~", "return 'not';"],
      ["==|=", "return '=';"],
      ["CONTAINS|Contains|contains", "return 'contains';"],
      ["[a-zA-Z0-9\\-\\.\\?\\*\\_]+|\\'[a-zA-Z0-9\\-\\.\\?\\*\\_\\s+]+\\'", "return 'STRING';"],
      ["$", "return 'EOF';"]
    ]
  },

  "bnf": {
    "query" : [
      ["logic EOF", "return $1"]
    ], 
    "logic" : [
      ["sub_logic", "$$ = $1"], 
      ["logic binary_operator sub_logic", "$$ = { 'type' : 'binary_logic', 'operator' : $2, 'left' : $1, 'right' : $3}"]
    ],
    "sub_logic" : [
      ["unary_operator key_value", "$$ = { 'type' : 'unary_logic', 'operator' : $1, 'right' : $2}"],
      ["key_value", "$$ = $1"]
    ],
    "key_value" : [
      ["STRING equality STRING", "$$ = { 'type' : 'equality', 'operator' : $2, 'left' : $1, 'right' : $3}"],
      ["( logic )", "$$ = $2"]
    ],
    "binary_operator" : [
      ["and", "$$ = '&'"], 
      ["or", "$$ = '|'"],
    ],
    "unary_operator" : [
      ["not", "$$ = 'not'"]
    ],
    "equality" : [
      ["=", "$$ = '='"], 
      ["!=", "$$ = '!='"],
      ["contains", "$$ = 'contains'"]
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

  match_sync: function (json_object, query_ast) {
    if (json_object.account != null) {
      delete json_object.account
    }
    try {
      return evaluate(query_ast, json_object)
    } catch (err) {
      console.trace(err)
      throw err
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
  var type = current_ast_node.type
  if (type == 'binary_logic') {
    return evaluate_binary_logic(current_ast_node, expression)
  } else if (type == 'unary_logic') {
    return evaluate_unary_logic(current_ast_node, expression)
  } else if (type == 'equality') {
    return evaluate_equality_expression(current_ast_node, expression)
  }
}

var evaluate_binary_logic = function (current_ast_node, expression) {
  var operator = current_ast_node.operator
  var left = evaluate(current_ast_node.left, expression)
  var right = false
  if ((operator == '|' && left) || (operator == '&' && !left)) {
    return left 
  }
  right = evaluate(current_ast_node.right, expression)
  if (operator == '|') {
    return left || right
  } else if (operator == '&') {
    return left && right
  }
}

var evaluate_unary_logic = function (current_ast_node, expression) {
  return !evaluate(current_ast_node.right, expression)
}

var evaluate_equality_expression = function (current_ast_node, expression) {
  var operator = current_ast_node.operator
  if (operator == '=') {
    return evaluate_equality(current_ast_node, expression)
  } else if (operator == '!=') {
    return evaluate_inequality(current_ast_node, expression)
  } else if (operator.toLowerCase() == 'contains') {
    return evaluate_contains(current_ast_node, expression)
  }
}

var evaluate_inequality = function (current_ast_node, expression) {
  var key = current_ast_node.left.toLowerCase()
  var value = (typeof current_ast_node.right === "string" ? remove_single_quote(current_ast_node.right.toLowerCase()) : current_ast_node.right)
  if (expression[key] != null) {
    if (typeof expression[key] === "object") {
      return expression[key].every(function (element, index, array) {
        return (typeof element === "string" ? (element.toLowerCase() != value) : (element != value))
      })
    } else {
      return (typeof expression[key] === "string" ? (expression[key].toLowerCase() != value) : (expression[key] != value))
    }
  } else {
    return true
  }
}

var evaluate_equality = function (current_ast_node, expression) {
  var key = current_ast_node.left.toLowerCase()
  var value = (typeof current_ast_node.right === "string" ? remove_single_quote(current_ast_node.right.toLowerCase()) : current_ast_node.right)
  if (expression[key] != null) {
    if (typeof expression[key] === "object") {
      return expression[key].some(function (element, index, array) {
        return (typeof element === "string" ? (element.toLowerCase() == value) : (element == value))
      })
    } else {
      return (typeof expression[key] === "string" ? (expression[key].toLowerCase() == value) : (expression[key] == value))
    }
  } else {
    return false
  }
}

var evaluate_contains = function (current_ast_node, expression) {
  var key = current_ast_node.left.toLowerCase()
  var value = (typeof current_ast_node.right === "string" ? remove_single_quote(current_ast_node.right.toLowerCase()) : current_ast_node.right)
  if (expression[key] != null) {
    if (typeof expression[key] === "object") {
      return expression[key].some(function (element, index, array) {
        return (typeof element === "string" ? (element.toLowerCase().indexOf(value) > -1) : (element.indexOf(value) > -1))
      })
    } else {
      return (typeof expression[key] === "string" ? (expression[key].toLowerCase().indexOf(value) > -1) : (expression[key].indexOf(value) > -1))
    }
  } else {
    return false
  }
}

var remove_single_quote = function (value) {
  return value.replace(/\'/g, '')
}