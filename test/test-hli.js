const gohttp = require('../gohttp.js');

let hcli = new gohttp()

for(let i=0; i<10; i++) {
    hcli.get('https://localhost:2021/test',{
        timeout:5000,
        family: 4,
        query: {name: 'ty'}
      })
    .then(res => {
        console.log(res.text());
    }, err => {
        throw err; 
    })
    .catch(err => {
        console.log(err);
    });

    hcli.post('https://ip6-localhost:2021/test', {
        body : {user : 'brave'},
        family: 6,
        query: {key: 12309}
    })
    .then(res => {
        console.log(res.text());
    }, err => {
        throw err;
    })
    .catch(err => {
        console.log(err);
    });
}
