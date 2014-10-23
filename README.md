# Sift

What is sift? A __lightweight__ and __easy-to-use__ tool to manage your clouds!

## What does it do?

Sift simply does the following steps:

- Gathers all of your instances from different cloud providers and different accounts that are configured
- Filters the servers based on the provided query (if any)
- Execute any command on the result of previous step. The default command is `ssh`

## Features

Sift supports the following (more expected to come):

- Add as many _accounts_ you need!
- Add as many _cloud providers_ you need!
- Use our simple and easy query language to build _powerfull queries_ that can be used to filter results from all providers
- Execute any _shell commands_ on any set of servers
- Define _aliases_ for different tasks you need to do so you don't need to type out everything everytime
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
sudo npm install
sudo npm link
```

## How to run

// TODO

### Sample `.sift.json` file

`.sift.json` file is created in your home directory the first time you run `sift`. You can then edit the file to add more options to it!

```javascript
{
    "credentials": [
        {
            "name": "Sessions",
            "publicToken": "XXXXXXXXXXXXXXXXXXX",
            "token": "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
        	"type": "amazon"
        },
        {
            "name": "Main",
            "publicToken": "XXXXXXXXXXXXXXXXXXX",
            "token": "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
            "regions": [
                "us-east-1"
            ],
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

So in the above config we have defined 2 accounts namely `Sessions` and `Main` and both of them are connected to `amazon` cloud provider. `Sessions` account does not have any `regions` so `sift` will consider all available regions from the cloud provider which is `amazon`.

**Note**: Names you give to different accounts have nothing to do with the real account name in the cloud providers.

### Sample usages

If you run `sift` without any argument then it will show a list of all instances in the configured accounts. If you run it with `-l` it will list the current available accounts:

```bash
$ sift -l 
Realms amazon (us-east-1,us-west-2,eu-west-1,ap-northeast-1,ap-southeast-2) 
Main amazon (us-east-1) 
```

But `sift` comes with querying capability. For simple queries we have provided you with some arguments as following:

- `-n`: filtering based on the name of the instance
- `-image`: filtering based on the image id
- `-hostname`: filtering based on the hostname
- `-ip`: filtering based on the Ip address
- `--id`: filtering based on instance id

If you need to express a complete query then see next section.

### Query language

Use `-k` option together with a plugin name to get the list of supported keys that can be used in your queries.

```bash
$ sift -k amazon
[ 'id', 'name', 'region', 'hostname', 'account', 'image', 'ip' ]
```

In order to use `sift` query feature you need to use `-q`:

```bash
$ sift -q 'name contains session'
```

You can also put more statement and combine them with `and` and `or`:

```bash
$ sift -q '(name contains session) or (id = i-ae7fcafc)'
```

As you see the statement consists of key and values. Retrieving keys is mentioned in the previous section. 
You can combine logical statement as much as you need. If you need to have whitespaces in your values you can escape them list this:

```bash
$ sift -q '(name contains \'auth session\') or (id = i-ae7fcafc)'
```

#### Supported logical operators

Supported logical operators for the query system:
- `and`, `And`, `AND`, `&`
- `or`, `Or`, `OR`, `|`
- `not`, `Not`, `NOT`, `~`, `!`

#### Supported verbs

Supported verbs you can use in your key value statements:
- `contains`
- `<>`
- `!=`
- `=`


### Defining Aliases

// TODO