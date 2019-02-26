![Sift](https://raw.githubusercontent.com/Mojang/Sift/master/logo.png) 

[![Build Status](https://travis-ci.org/Mojang/Sift.svg?branch=master)](https://travis-ci.org/Mojang/Sift) [![NPM Version](http://img.shields.io/npm/v/cloud-sift.svg)](https://www.npmjs.com/package/cloud-sift)

What is Sift? A __lightweight__ and __easy-to-use__ tool for accessing your clouds!

## What does it do?

Sift simply does the following steps:

- Gathers all of your instances from different cloud providers and different accounts that are configured
- Filters the servers based on the provided query (if any)
- Executes any command on the result of the previous step (if provided). The default command is `ssh`

## Features

Sift supports the following (more expected to come):

- Add as many _cloud providers_ as you need!
- Add as many _accounts_ as you need!
- Use our simple and easy query language to build _powerful queries_ that can be used to filter results from all providers
- Execute any _shell command_ on a set of servers
- Define _aliases_ for different tasks you need to do so you don't have to type it out every time
- Ansible support!
- Flexible _configuration_


## Supported Cloud Providers

Current cloud providers we support at the moment:

- Amazon
- Digital Ocean


## How to install

`sift` is written in `node.js`. You can install it by using `npm` like this:

```bash
npm install -g cloud-sift
```

### Build from source

If you need the latest features (could be unstable) you can build from source by running the following:

```bash
git clone git@github.com:Mojang/Sift.git
cd Sift
npm install
sudo npm link
```

## How to run

### Configuration

`.sift.json` file is created in your home directory the first time you run `sift`. You can then edit the file to add more options to it!

```javascript
{
    "credentials": [
        {
            "name": "Sessions",
            "public_token": "XXXXXXXXXXXXXXXXXXX",
            "token": "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
            "type": "amazon"
        },
        {
            "name": "Main",
            "public_token": "XXXXXXXXXXXXXXXXXXX",
            "token": "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
            "regions": [
                "us-east-1"
            ],
            "type": "amazon"
        },
        {
            "name": "Example",
            "profile": "~/.aws/credentials profile name",
            "type": "amazon"
        },
        {
            "name": "Default credentials from ~/.aws/credentials",
            "type": "amazon"
        }
    ],
    "ssh_config": [
        {
          "priority": 0,
          "user": "ubuntu",
          "port": 22,
          "options": ["-o", "StrictHostKeyChecking no"]
        }
    ]
}
```

So in the above config we have defined 2 accounts namely `Sessions` and `Main` and both of them are connected to `amazon` cloud provider. `Sessions` account does not have any `regions` so `sift` will consider all available regions from the cloud provider which is `amazon` in this example.

**Note**: Names you give to different accounts have nothing to do with the real account name in the cloud providers.

### Sample usages

If you run `sift` without any argument then it will show a list of all instances in the configured accounts. If you run it with `-l` it will list the current available accounts:

```bash
$ sift -l 
Sessions amazon (us-east-1,us-west-2,eu-west-1,ap-northeast-1,ap-southeast-2) 
Main amazon (us-east-1) 
```

`sift` also comes with querying capability. For simple queries we have provided you with some arguments as following:


-  `-n, --servername <name>`          Filter by name
-  `-H, --hostname <hostname>`        Filter by hostname
-  `-i, --ip <ip>`                    Filter by ip
-  `-I, --image <image>`              Filter by image id
-  `--id <id>`                        Filter by id

You can specify multiple values for the above filters by comma separating them.

If you need to express a complete query then see next section.

### Query language

Use `-k` option together with a plugin name to get the list of supported keys that can be used in your queries.

```
$ sift -k amazon
Keys for amazon: id, name, region, hostname, account, image, ip, private-ip, private-hostname, keypair, type, security-group, availability-zone, tag.*
```

In order to use `sift` query feature you need to use `-q`:

```bash
$ sift -q 'name contains session'
```

You can also have more than one statement, and combine them with `and` / `or`:

```bash
$ sift -q '(name contains session) or (id = i-ae7fcafc)'
```

As you see the statement consists of key-value pairs. Retrieving keys is mentioned in the previous section. 
You can combine logical statement as much as you need. If you need to have whitespaces or use `sift` keywords in your values you can escape them by using double qoutes like this:

```bash
$ sift -q "(name contains 'auth session') or (id = i-ae7fcafc)"
```

#### Supported logical operators

Supported logical operators for the query system:

-  `and`, `And`, `AND`, `&`
-  `or`, `Or`, `OR`, `|`
-  `not`, `Not`, `NOT`, `~`, `!`

#### Supported verbs

Supported verbs you can use in your key-value statements:

-  `contains`, `CONTAINS`, `Contains`
-  `<>`, `!=`
-  `=`, `==`


### Running commands

You can run shell commands on one or many instances that matches your query:

```bash
$ sift -q 'name contains session' -c 'uptime'
```

This commands will only be executed on the instance you select but if you want to execute the command on all matching instances you can use `-A` like this:

```bash
$ sift -q 'name contains session' -c 'uptime' -A
```

### Aliases

If you're running some queries every day you can define alias for them so you don't have to type them out every time you need them. You can use the key `alias` in your config file to define a list of aliases:

```javascript
{
   "alias":{
      "session":{
         "accounts":[
            "Sessions"
         ],
         "query":"(tag.type = Auth) AND (tag.environment = PRODUCTION)"
      },
      "session log":{
         "accounts":[
            "Sessions"
         ],
         "query":"(tag.type = Auth) AND (tag.environment = PRODUCTION)",
         "command":"tail -1000f /opt/session-logs/session.log"
      }
   }
}
```

And you can use them like this:

```bash
$ sift session
```

```bash
$ sift session log
```

#### Alias variables
An alias can include the following parameters:

- `accounts` A list of account that the alias matches
- `query` A query to match certain hosts
- `regions` Which regions to match
- `command` A command to run on the matching hosts
- `user` The user that will be used for connecting
- `port` The port that will be used for connecting
- `keyfile` Path to the keyfile that will be used for connecting
- `private_ip` Use the private ip for connecting to the matching hosts
- `public_ip` Use the public ip for connecting to the matching hosts
- `options` List of extra ssh arguments, each item will be separated by a space
- `run_on_all` Run command (if specified, by alias or command argument) on all resulting hosts

All alias variables are optional in themselves, but either accounts or query is required.  
Most alias variables can be overriden by their command arguments such as -q for query.  
`user`, `port`, `keyfile`, `private_ip`, `public_ip & `options` can also be set as an ssh config.  
Setting it in an alias or using will override it.  

#### Including alias from file

You can define your aliases in a separate file and include them in your config file as the following:

```javascript
{
    "credentials": ...
    "ssh_config": ...
    "alias_includes": ["/Users/user/Documents/my_aliases.json"]
}
```

And `my_aliases.json` looks like this:

```javascript
{
    "session":{
     "accounts":[
        "Sessions"
     ],
     "query":"(tag.type = Auth) AND (tag.environment = PRODUCTION)"
    },
    "session log":{
     "accounts":[
        "Sessions"
     ],
     "query":"(tag.type = Auth) AND (tag.environment = PRODUCTION)",
     "command":"tail -1000f /opt/session-logs/session.log"
    }
}
```

#### Alias auto completion

Sift has support for auto completion of aliases in bash/zsh.
To install it you can simply run 
```bash
$ sift --autocompletion
```

Or if you prefer installing it manually, you can run something like this:

For **zsh**

```bash
echo '. <(sift --completion)' >> .zshrc
```

For **bash**

```bash
sift --completion >> ~/sift.completion.sh
echo 'source ~/sift.completion.sh' >> .bash_profile
```


### SSH
#### SSH command arguments
Sift supports the following command arguments to modify the behaviour when connecting to a host:

-  `-u, --user <user>`                SSH user
-  `-p, --port <port>`                SSH port
-  `-K, --keyfile <keyfile>`          SSH keyfile
-  `-c, --ssh_command <ssh_command>`  Command to run on host(s)
-  `-P, --private_ip`                 Use the private ip of the host when connecting
-  `--public_ip`                      Use the public ip of the host when connecting

#### SSH options
SSH options are defined in the config as "ssh_config".

- `accounts` A list of account that the ssh config matches
- `query` A query to match certain hosts
- `priority` (required) The priority of the ssh config, higher priority overrides a lower priority config. 0 means default and will match anything
- `user` The user that will be used for connecting
- `port` The port that will be used for connecting
- `keyfile` Path to the keyfile that will be used for connecting
- `private_ip` Use the private ip for connecting to the matching hosts
- `options` List of extra ssh arguments, each item will be separated by a space

Unless stated otherwise, all options are optional.  
Either `query` or `accounts` are required, unless the ``priority is 0, in which case it will match anything. Only one config can have priority 0.  
`query` and `accounts` can be combined in order to only try matching the query, if the accounts match.
Priorities have no inheritance at this time.

Example:
```
"ssh_config": [{
   "priority":0,
   "user":"ubuntu",
   "port":22,
   "options":[
      "-o",
      "StrictHostKeyChecking no"
   ]
},
{
   "priority":5,
   "user":"root",
   "query": "tag.type = CentOS"
}]
```

In the above example, by default the user is ubuntu, and has some extra options.  
When the tag "type" matches CentOS, the user will be set to root, and no extra options will be applied.

### Filtering

#### Region

If you want all accounts of the same type that has the specified region to be used, regardless of their configured regions, you can use the config option `force_regions`, or use the command argument `-f` along with the `-r` argument.

#### Account

If you want to run `sift` against specific account you can use `-a` argument like this:

```bash
$ sift -a Sessions -q 'name contains auth'
```

#### Type

You can also filter based on type of accounts. For example if you want to run `sift` for _amazon_ accounts you do it like this:

```bash
$ sift -t amazon -q 'name = auth'
```

#### Icinga
Using the icinga plugin, you can filter on hosts or services that are down in icinga.
In the config, you need to provide `icinga_host`, `icinga_user`, and `icinga_pass`.
To enable the filter, can use the `-e <filter>` commandline argument, or add "icinga" to the enabled_filters list in config.js

### Ansible support
It is possible to run an ansible playbook on result set of a filtering. Sift support the following arguments to run ansible playbooks:

-  `--ansible <ansible_playbook>`     Run an ansible playbook on target host(s)
-  `--ansible_extra_args <ansible_extra_args>` Pass extra arguments to ansible-playbook

If you have the following playbook saved in a file named `uptime-playbook.yml`:

```yaml
---
- hosts: all
  gather_facts: no
  tasks:
  - shell: uptime
    register: uptime
 
  - debug: var=uptime.stdout_lines
```

You can use it with sift like this:

```bash
$ sift -q 'name contains session' --ansible uptime-playbook.yml -A
```

And if you need to pass in extra arguments to ansible:

```bash
$ sift -q 'name contains session' --ansible uptime-playbook.yml --ansible_extra_args 'some_var=some_value' -A
```

### Local provider

Sift also comes with a "local" provider that can load a list of servers from local json files.
To use this, create an account with the type "local" and specify the file(s) to import as "local_files".

```
  { 
    "name": "Local",
    "type": "local",
    "local_files": ["/Users/user/local_servers.json"]
  }
```

The file containing the servers can look as follows:
```
[{
  "id": "local",
  "name": "Local machine",
  "hostname": "127.0.0.1"
}]
```

You can specify any fields and use them in the queries, however, `id`, `name` and `hostname` are required.

### Reference config file

```javascript
{
   "credentials":[
      {
         "name":"Amazon",
         "public_token":"XXXXXXXXXXXXXXXXXXXXXXXX",
         "token":"XXXXXXXXXXXXXXXXXXXXXXXXXX",
         "regions":[
            "us-east-1",
            "us-west-2",
            "eu-west-1",
            "ap-northeast-1",
            "ap-southeast-2"
         ],
         "type":"amazon"
      },
   ],
   "ssh_config":[
      {
         "priority":0,
         "user":"ubuntu",
         "port":22,
         "options":[
            "-o",
            "StrictHostKeyChecking no"
         ]
      }
   ],
   "alias_includes":[
      "/Users/user/Documents/my_aliases.json"
   ],
   "plugins":[
      "amazon",
      "digitalocean",
      "local"
   ],
   "allowed_filters":[

   ],
   "enabled_filters":[

   ],
   "force_regions":false,
   "alias":{
        "session":{
         "accounts":[
            "Sessions"
         ],
         "query":"(tag.type = Auth) AND (tag.environment = PRODUCTION)"
        }
   },
   "auto_connect_on_one_result":true
}
```

### Contact
Got any questions? You can email us at [sift@mojang.com](mailto:sift@mojang.com)

### Authors
* [Amir Moulavi](https://twitter.com/mamirm)
* [David Marby](http://dmarby.se)

### License
Distributed under the [MIT License](https://github.com/Mojang/Sift/blob/master/LICENSE.md)

### Thanks to
* [Per Lööv](http://perloov.com) for the awesome logo
* [Nijiko Yonskai](https://github.com/Nijikokun) for helping with cleaning up the code
