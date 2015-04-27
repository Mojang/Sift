module.exports = exports = {
  credentials: [
    {
      name: 'Example',
      public_token: 'public_token',
      token: 'token',
      regions: ['us-east-1', 'eu-west-1'],
      type: 'amazon'
    },
    {
      name: 'Example',
      profile: '~/.aws/credentials profile name',
      regions: ['us-east-1', 'eu-west-1'],
      type: 'amazon'
    },
    {
      name: 'Default credentials from ~/.aws/credentials',
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
  plugins: ['amazon', 'digitalocean', 'local'],
  allowed_filters: ['icinga'],
  enabled_filters: [],
  force_regions: false,
  ssh_config: [
    {
      priority: 0,
      user: 'root',
      port: 22,
      options: []
    }
  ],
  alias: {},
  alias_includes: [],
  auto_connect_on_one_result: true
}
