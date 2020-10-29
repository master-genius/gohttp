
![](images/gohttp.png)

# gohttp

针对HTTP/1.1封装的客户端请求库。

基于Promise实现，可以通过then接收返回结果，或者配合async/await使用。

## 安装

```
npm i gohttp
```

## GET请求

``` JavaScript

const gohttp = require('gohttp');

gohttp.get('http://localhost:2020/')
        .then(res => {
            console.log(res.headers, res.status);
            return res.text();
        })
        .then(result => {
            console.log(result);
        });

```

## POST请求

``` JavaScript

const gohttp = require('gohttp');

gohttp.post('http://localhost:2020/p', {
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

## PUT请求

``` Javascript
const gohttp = require('gohttp');

gohttp.put('http://localhost:2020/p', {
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

## DELETE请求

``` JavaScript

const gohttp = require('gohttp');

gohttp.delete('http://localhost:2020/p/123')
        .then(res => {
            return res.text();
        })
        .then(result => {
            console.log(result);
        });

```


## 上传文件

``` JavaScript

const gohttp = require('gohttp');

gohttp.upload('http://localhost:2020/upload', {
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

## 简单上传

基于gohttp.upload封装的up函数参数更加简单：

``` JavaScript

gohttp.up('http://localhost:1234/upload', {
    name : 'image'
    file : 'images/123.jpg'
}).then(res => {
    return res.text();
}).then(d => {
    console.log(d);
});

```

## 下载文件

``` JavaScript

const gohttp = require('gohttp');

gohttp.download('https://localhost:2021/download', {
  dir: process.env.HOME + '/download/',
  //输出进度提示
  progress: true
}).then(d => {
    console.log(d || '');
}).catch(err => {
    console.log(err);
});

```