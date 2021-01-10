const ioioi = require('./middleware');

function context() {
  return {
    exec : null,
    method : '',
    pass : ''
  };
}

let ioi = new ioioi({debug:true});

ioi.use(async (c, next) => {
  console.log('m1 in');
  await next();
  console.log('m1 out');
});

ioi.use(async (c, next) => {
  console.log('  m2 in');
  await next();
  console.log('  m2 out');
});

ioi.use(async (c, next) => {
  console.log('    m3 in');
  await next();
  console.log('    m3 out');
});

let b = context();

b.method = 'POST';
b.pass = 'abcd';
b.exec = async (c) => {
  console.log('      I am b');
};

ioi.run(b);
