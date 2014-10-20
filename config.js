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
      regions: ['nyc1', 'ams1', 'sfo1', 'nyc2', 'ams2', 'sgp1', 'lon1', 'nyc3', 'ams3'],
      type: 'digitalocean'
    },
    {
      name: 'Example',
      token: 'token',
      type: 'digitalocean'
    }
  ],
  plugins: ['amazon', 'digitalocean'],
  allowed_filters: ['icinga'],
  enabled_filters: [],
  force_regions: false
}