module.exports = exports = {
	credentials: [
		{
			name: 'Example',
			publicToken: 'publicToken',
			token: 'token',
			regions: ['us-east-1', 'eu-west-1'],
			type: 'amazon'
		},
		{
			name: 'Example',
			token: 'token',
			regions: ['nyc1'],
			type: 'digitalocean'
		}
	],
	search_plugins: ['amazon', 'digitalocean'],
	force_regions: false
}