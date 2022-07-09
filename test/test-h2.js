'use strict'

const hiio = require('../hiio')

let hii = new hiio()

let h = hii.connect('https://localhost:2021')

for (let i = 0; i < 10; i++) {
  h.get({
    path: '/test',
    query: {n: 234}
  })
  .then(ret => {
      console.log(ret)
  })
  .catch (err => { console.error(err) })
  
  h.post({
    path: '/test?x=3244',
    body: {name: 'rich', key: 12309012839990},
    query: 'y=123'
  })
  .then(ret => {
      console.log(ret)
  })
  .catch (err => { console.error(err) })
}

setTimeout(() => {
  h.close()
}, 8000);

