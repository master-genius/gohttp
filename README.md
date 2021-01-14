
![](images/httpcli.jpg)

# gohttp

针对HTTP/1.1和HTTP/2封装的客户端请求库，从4.0版本开始，支持HTTP/2，之前的版本只支持http1。

基于Promise实现，可以通过then接收返回结果，或者配合async/await使用。

## 安装

```
npm i gohttp
```

**以下是3.x版本的http1请求过程，从4.0开始，接口不变，但是导出方式发生了变化。因为包含http1和http2的客户端请求，这两个协议在不使用APLN支持，并且没有兼容接口的时候，是无法自动适应的。这里给出的封装就是基于http/https模块封装了HTTP/1.1的请求，基于http2模块封装了HTTP/2的请求。**

## HTTP/1.1协议的请求

> 从4.0开始，导出方式：
> **const {httpcli} = require('gohttp')**

> 接口使用方式不变

### GET请求

``` JavaScript

const {httpcli} = require('gohttp');

httpcli.get('http://localhost:2020/')
        .then(res => {
            console.log(res.headers, res.status);
            return res.text();
        })
        .then(result => {
            console.log(result);
        });

```

### POST请求

``` JavaScript

const {httpcli} = require('gohttp');

httpcli.post('http://localhost:2020/p', {
            body : {
                user: 'wang'
            }
        })
        .then(res => {
            return res.text();
        })
        .then(result => {
            console.log(result);
        });

```

### PUT请求

``` Javascript
const {httpcli} = require('gohttp');

httpcli.put('http://localhost:2020/p', {
            body : {
                user: 'wang'
            }
        })
        .then(res => {
            return res.text();
        })
        .then(result => {
            console.log(result);
        });
```

### DELETE请求

``` JavaScript

const {httpcli} = require('gohttp');

httpcli.delete('http://localhost:2020/p/123')
        .then(res => {
            return res.text();
        })
        .then(result => {
            console.log(result);
        });

```


### 上传文件

``` JavaScript

const {httpcli} = require('gohttp');

httpcli.upload('http://localhost:2020/upload', {
            files: {
                image: [
                    'pictures/a.jpg',
                    'pictures/b.png'
                ],
                video: [
                    'videos/a.mp4',
                    'videos/b.mp4'
                ]
            },
            //要携带表单数据需要form选项
            //form : {}
        })
        .then(res => {
            return res.text();
        })
        .then(result => {
            console.log(result);
        });

```

### 简单上传

基于httpcli.upload封装的up函数参数更加简单：

``` JavaScript

httpcli.up('http://localhost:1234/upload', {
    name : 'image'
    file : 'images/123.jpg'
}).then(res => {
    return res.text();
}).then(d => {
    console.log(d);
});

```

### 下载文件

``` JavaScript

const {httpcli} = require('gohttp');

httpcli.download('https://localhost:2021/download', {
  dir: process.env.HOME + '/download/',
  //输出进度提示
  progress: true
}).then(d => {
    console.log(d || '');
}).catch(err => {
    console.error(err);
});

```

## HTTP/2 请求

### 连接

```javascript

const {http2cli} = require('gohttp')

//返回值是包装了http2Session实例的一个对象，并提供了常用请求和request方法。
hsession = http2cli.connect('http://localhost:1234')


```

### 连接选项

```javascript

const {http2cli} = require('gohttp')

//返回值是包装了http2Session实例的一个对象，并提供了常用请求和request方法。
let hsession = http2cli.connect('http://localhost:1234', {
    //请求空闲10秒则超时。
    timeout: 10000,
    //此时，断开连接会自动重新连接。
    keepalive: true
})


```

### 连接池

```javascript

const {http2cli} = require('gohttp')

//此时连接选项keepalive自动被设置为true。
let hs = http2cli.connectPool('http://localhost:1234', {
    //最大连接数量
    max: 5
})

//hs能使用的接口和connect返回的hsession一致。

```

### 请求

```javascript

const {http2cli} = require('gohttp')

let hs = http2cli.connect('http://localhost:1234')

//针对GET、POST、DELETE、PUT、OPTIONS提供了快速调用的同名小写方法。
//本质上都是调用了request。

hs.get({
    path : '/test',
})
.then(ret => {
    //ret是包含了headers, ok, status, error, data, text, json, blob属性的对象。
    console.log(ret.headers, ret.text())
})

//如果body是
hs.post({
    path : '/data',
    body : {
        name : 'Wang',
        id : '1001'
    }
})
.then(ret => {
    console.log(ret.headers, ret.text())
})

hs.request({
    method : 'PUT',
    path : '/content',
    headers : {
        'content-type' : 'text/plain'
    },
    body : {
        id : '1001',
        nickname : 'unix-great'
    }
})
.then(ret => {
    console.log(ret.headers, ret.text())
})

```

### 上传文件

```javascript

const {http2cli} = require('gohttp')

//返回值是包装了http2Session实例的一个对象，并提供了常用请求和request方法。
let hs = http2cli.connect('http://localhost:1234', {
    //此时，断开连接会自动重新连接。
    keepalive: true
})

hs.upload({
    path : '/upload',
    files : {
        //键值 即为 上传名
      image : [
        process.env.HOME + '/tmp/images/123.jpg',
        process.env.HOME + '/tmp/images/space2.jpg',
      ],
      video : [
          process.env.HOME + '/tmp/images/a.mp4',
      ]
    },
    //可以使用form携带其他表单项
    form : {
        id : '1001'
    }
})
.then(ret => {
    console.log(ret.error)
    console.log(ret.status, ret.text())
})

```

### 持久连接

使用http2作为持久连接，一个连接可以发送多个请求，可以使用HTTP/2协议作为查询服务，基于协议的强大特性，可以完成比较复杂的功能。并且，可以方便实现RPC，这方面其实已经有先例。HTTP/2本身是支持不使用HTTPS的，浏览器在实现上，要求必须是启用HTTPS，但是基于Node.js，使用http2是可以不启用https完成通信，在内网通信时，可以处理更快。
