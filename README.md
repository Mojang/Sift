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

**Note**: Names you give to different accounts are completely optional and has nothing to do with the real account name in the cloud providers

### Sample usages

// TODO

### Query language

// TODO