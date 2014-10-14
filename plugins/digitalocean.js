var nautical = require('nautical')
var util = require('../util')
// Todo figure out how to do ip-range/like?
// Todo figure out how to do multiple values of same filter?
var filterNames = {
	'name': ['name'],
	'region': ['region','slug'],
	'ip': ['networks', 'v4', 0, 'ip_address'],
	'ipv6': ['networks', 'v6', 0, 'ip_address'],
	'hostname': ['name']
}
var digitalOcean = module.exports = {
	search: function (account, filters, callback) {
		// Remove me
		//filters = [{ name: 'name', value: 'dmarby.se' }, { name: 'ip', value: '208.68.38.3' }, { name: 'ip', value: '104.131.1.207'}]
		var result = []
		var client = nautical.getClient({ token: account.token })
		client.droplets.list(function (err, reply) {
			var servers = reply.body.droplets;
			//Todo error handling
			//Todo get next page
			/*// get the next page
    			if ('function' === typeof reply.next)
        			reply.next(callback);
  				  else
        				console.log(imageList);*/
        	account.regions.forEach(function (region) {
        		if (filters == null) {
        			filters = []
        		}
        		filters.push({ name: 'region', value: region })
        	})
			servers.forEach(function (server) {
				var condensedFilters = []
				if (filters && filters.length > 0) {
					var filtersToAdd = {}
					filters.forEach(function (filter) {
						if (filterNames[filter.name] != null) {
							if (filtersToAdd[filter.name] == null) {
								filtersToAdd[filter.name] = { 
									name: filter.name, 
									values: [ filter.value ] 
								}
							} else {
								filtersToAdd[filter.name].values.push(filter.value)
							}
						} else {
							console.log('Ignoring invalid filter %s'.red, filter.name)
						}
					})
					Object.keys(filtersToAdd).forEach(function (key) {
						var filter = filtersToAdd[key]
						condensedFilters.push(filter)
					})
					var matchCount = 0
					condensedFilters.forEach(function (filter) {
						var filterName = filterNames[filter.name]
						var element;
						filterName.forEach(function (specificFilterName) {
							if (element == null) {
								element = server[specificFilterName]
							} else {
								element = element[specificFilterName]
							}
						})
						if (element == filter.value || (filter.values != null && filter.values.indexOf(element) > -1)) {
							matchCount++
						}
					})
				}
				if (!filters || filters.length == 0 || matchCount == condensedFilters.length) {
					result.push({
						'id': server.id,
						'name': server.name,
						'region': server.region.slug,
						// Todo show ipv6? command line argument?
						'hostname': server.networks.v4[0].ip_address,
						'type': 'digitalocean',
						'account': account
					})
				}
			})
			callback(result)
		})
	},
	// Todo option to use DNS for connection?
	ssh: function (server, user, port, keyfile, options) {
		util.ssh(server, user, port, keyfile, options)
	},

	display: function (server, index) {
		util.display(server, index)
	},

	regions: ['nyc1', 'ams1', 'sfo1', 'nyc2', 'ams2', 'sgp1', 'lon1', 'nyc3', 'ams3']
}