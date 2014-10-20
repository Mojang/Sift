
var parser = require('./parser')

/*
* test
**/

var instances = [
	{
		'instance-id' : 'i-12334',
		'ip' : '127.0.0.1',
		'ami-id' : 'ubuntu-14.04-kernel',
		'type' : 'McoController',
		'environment' : 'PRODUCTION'
	},
	{
		'instance-id' : 'i-66666',
		'ip' : '54.54.0.1',
		'ami-id' : 'ubuntu-12.10-kernel',
		'type' : 'PeoController',
		'environment' : 'PRODUCTION'
	}
]

//var sample_query = '(instance-id = i-32333 & ip = 127.0.0.1) | (ip = 54.54.0.1 & ami-id = ubuntu-12.10-kernel)'
var sample_query = '((type has PEO) OR (ip = 127.0.0.1 AND ami-id has ubuntu)) and environment <> STAGE'



try {
	var result = parser.generate_query_ast_sync(sample_query)
} catch (err) {
	console.error(err.message)
	throw err
}

for (var instance in instances) {
	var cur = instances[instance]
	parser.match(cur, result, function (err, data) {
		if (err) {
			console.error(err)
		} else if (data) {
			console.log(cur)
		}
	})
}


