var nautical = require('nautical')
// Todo figure out how to do ip-range/like?
var filterNames = {
	'name:': ['name'],
	'region': ['region','slug'],
	'ip': ['networks', 'v4', 0, 'ip_address'],
	'ipv6': ['networks', 'v6', 0, 'ip_address'],
	'hostname': ['name']
}
var digitalOcean = module.exports = {
	search: function (account, filters, callback) {
		// Remove me
		filters = [{ name: 'ip', 'value': '208.68.38.3' }]
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
			servers.forEach(function (server) {
				var matchesFilter = true
				if (filters && filters.length > 0) {
					matchesFilter = false
					filters.forEach(function (filter) {
						var filterName = filterNames[filter.name];
						// Todo alert that filter is invalid?
						if (filterName != null) {
							var element;
							filterName.forEach(function (specificFilterName) {
								if (element == null) {
									element = server[specificFilterName]
								} else {
									element = element[specificFilterName]
								}
							})
							if (element == filter.value) {
								matchesFilter = true
							}
						}
					})
				}
				if (matchesFilter) {
					result.push(server.region.slug)
				}
			})
			callback(result)
		})
	}
}