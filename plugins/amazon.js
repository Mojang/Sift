var aws = require('aws-sdk')
// Todo search by both internal and external dns/ip? private-dns-name, private-ip-address
// Todo figure out how to do tags
var filterNames = {
	'id': 'instance-id',
	'name': 'tag:Name',
	'ip': 'association.public-ip',
	'ipv6': 'association.public-ip',
	'hostname': 'dns-name',
	'type': 'instance-type',
	'tag': 'tag:{TAG}'
}

var amazon = module.exports = {
	search: function (account, filters, callback) {
		// Remove me
		filters = [{ name: 'name', 'value': 'MojangStatus' }]
		var params = {
		  Filters: [
		    {
			  Name: 'instance-state-name',
		      Values: [
		        'running',
		      ]
		    }
		  ]
		}
		if (filters && filters.length > 0) {
			var filtersToAdd = {}
			filters.forEach(function (filter) {
				var name = filterNames[filter.name]
				if (name != null) {
					if (filtersToAdd[name] == null) {
						filtersToAdd[name] = { 
							Name: name, 
							Values: [ filter.value ] 
						}
					} else {
						filtersToAdd[name].Values.push(filter.value)
					}
				}
			})
			Object.keys(filtersToAdd).forEach(function (key) {
				var filter = filtersToAdd[key]
				params.Filters.push(filter)
			})
		}
		var result = []
		aws.config.update({ accessKeyId: account.publicToken, secretAccessKey: account.token })
		var todo = account.regions.length;
		account.regions.forEach(function (region) {
			amazon.searchRegion(region, params, function (servers) {
				servers.forEach(function (server) {
					result.push(server.Instances[0].Tags[0].Value)
				})
				todo--;
				if (todo == 0) {
					callback(result);
				}
			})
		})
	},
	searchRegion: function (region, params, callback) {
		var ec2 = new aws.EC2({ region: region })
		// Todo, check for NextToken and use for pagination, in case of more than 1k servers
		// Todo, error handling
		ec2.describeInstances(params, function(err, data) {
		  if (err) {
		  	return console.log(err, err.stack)
		  }
		  callback(data.Reservations)
		  //console.log(data.Reservations[0].Instances[0].Placement.AvailabilityZone)
		})
	}
}