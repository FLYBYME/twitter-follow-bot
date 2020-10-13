const Twit = require('twit');
const config = process.env || require('./config');

const express = require('express')

const twit = new Twit(config);
const screen_names = config.screen_names.split(',');
const search_terms = config.search_terms.split(',');

const intervals = [60, 600]; // min, max (in seconds)
const otherList = 'web-development-datavis';


let counter = 0;
// Initialise:
loop();

// Execute on irregular intervals:
function loop() {
    counter++;

    execute().catch((err) => {
        console.log(err)
    });
    setTimeout(loop, randomTime(...intervals));
    if (counter > 10) {
        counter = 0;
        remove().catch((err) => {
            console.log(err)
        });
    }
}

function remove() {
    var randomList = getRandom(search_terms);
    return removeFromList(getRandom([randomList, otherList]));
}


// Do something random:
function execute() {
    var randomList = getRandom(search_terms);
    return findUserByTopic(randomList).then(function (user) {
        console.log(user)
        addToList(otherList)(user)
    });
}


// Choose a random follower of someone on the list:
function findUserByFollowers(screenName) {
    console.log(`Finding a user who follows @${screenName}...`);
    return twit.get('followers/list', { screen_name: screenName })
        .then(({ data }) => {
            console.log(data)
            if (!data.users) throw data.errors;
            return data.users.filter((user) => !user.following)
                .map((user) => user.screen_name);
        })
        .then(getRandom)
        .catch(console.error);
}


// Choose a random user tweeting about a topic:
function findUserByTopic(list) {
    console.log(`Finding a user tweeting about ${list}...`);
    return twit.get('search/tweets', {
        q: `${list} -${config.username}`,
        count: 100
    })
        .then(({ data }) => {
            if (!data.statuses) throw data.errors;
            return data.statuses
                .filter((status) => !status.user.following)
                .map((status) => status.user.screen_name)
                .filter(unique);
        })
        .then(getRandom)
        .catch(console.error);
}


// Follow a user, mute them, and add them to a list:
function addToList(list) {
    return (user) => {
        twit.post('friendships/create', {
            // slug: list,
            //owner_screen_name: config.username,
            screen_name: user
        })
            .then(({ data }) => {

                console.log(data)
                if (!data.id) {
                    throw data.errors;
                } else {
                    console.log(`Following @${user}`);
                }
            })
            .catch(console.error);
        return twit.post('lists/members/create', {
            slug: list,
            owner_screen_name: config.username,
            screen_name: user
        })
            .then(({ data }) => {

                console.log(data)
                if (!data.id) {
                    throw data.errors;
                } else {
                    console.log(`Added @${user} to the ${list} list.`);
                }
            })
            .catch(console.error);
    }
}


// Remove a random user from a list, if they don't follow me back:
function removeFromList(list) {
    return twit.get('lists/members', {
        slug: list,
        owner_screen_name: config.username,
        skip_status: 1,
        include_entities: false
    }).then((resp) => resp.data.users).then((users) => {
        if (!users || !users.length) throw `Error: List '${list}' is empty.`;
        return users.map(user => user.screen_name);
    }).then((users) => twit.get('friendships/lookup', {
        screen_name: users
            .sort(shuffle)
            .slice(0, 99)
            .join(',')
    })).then((resp) => resp.data
        .filter((user) => user.connections.indexOf('followed_by') < 0)
        .map((user) => user.screen_name)
    ).then(getRandom).then((user) => {
        twit.post('friendships/destroy', {
            //slug: list,
            //owner_screen_name: config.username,
            screen_name: user
        })
            .then(() => user)
        return twit.post('lists/members/destroy', {
            slug: list,
            owner_screen_name: config.username,
            screen_name: user
        })
            .then(() => user)
    }
    )
    .then((user) => {
        console.log(`Removed @${user} from the ${list} list.`);
    })
    .catch(console.error);
}


function unique(value, index, self) {
    return self.indexOf(value) === index;
}

function shuffle() {
    return 0.5 - Math.random();
}

function getRandom(arr) {
    return arr[Math.floor(arr.length * Math.random())];
}

function randomTime(min, max) {
    return Math.round((Math.random() * (max - min)) + min) * 1000;
}
const app = express()
const port = process.env.PORT || 8080;

app.get('/', (req, res) => {
    res.send('Hello World!')
})
app.get('/remove', (req, res) => {

    remove();
    res.send('removed')
})
app.get('/add', (req, res) => {

    execute();
    res.send('ADDED')
})

app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`)
})
