
var parser = require('./query_parser')

/*
* test
**/

var instances = [
  {
    'name' : 'McoController - PRODUCTION',
    'instance-id' : 'i-12334',
    'ip' : '127.0.0.1',
    'ami-id' : 'ubuntu-14.04-kernel',
    'type' : 'McoController',
    'environment' : 'PRODUCTION'
  },
  {
    'name' : 'PeoController - PRODUCTION',
    'instance-id' : 'i-66666',
    'ip' : '54.54.0.1',
    'ami-id' : 'ubuntu-12.10-kernel',
    'type' : 'PeoController',
    'environment' : 'PRODUCTION'
  }
]

var sample_query = '! ip = 54.54.0.1'
//var sample_query = "((name CONTAINS 'PeoController - PRODUCTION') OR (ip = 127.0.0.1 AND ami-id contains ubuntu)) & environment <> STAGE"


try {
  var result = parser.generate_query_ast_sync(sample_query)
  console.log(JSON.stringify(result, null, 4))
} catch (err) {
  console.error(err.message)
  throw err
}

instances.forEach(function (cur) {
  parser.match(cur, result, function (err, data) {
    if (err) {
      console.error(err)
    } else if (data) {
      console.log(cur)
    }
  })
})