# ffmpegGUI

### 项目说明

基于 electron-vue + ffmpeg 的 GUI

### 项目截图

![screenshot1](./screenshot/screenshot-01.png)
![screenshot2](./screenshot/screenshot-02.png)

### 遇到的问题

[如何开启硬件加速](https://zhen-ke.github.io/2019/06/17/development-ffmpeggui/#如何开启硬件加速)

[打包后electron里asar不能使用二进制文件的问题](https://zhen-ke.github.io/2019/06/17/development-ffmpeggui/#打包后-electron-asar-不能使用二进制文件的问题)

[如何通过Webpack打包不同平台的二进制文件到APP里](https://zhen-ke.github.io/2019/06/17/development-ffmpeggui/#如何通过-Webpack-打包不同平台的二进制文件到-APP-里)

### 待完善

- [x] 减小打包过大的问题（目前默认是打包全平台的 ffmpeg）
- [ ] 增加配置项（目前所有的配置默认都是写死的，比如转视频时默认会把任意格式的视频转 MP4）
- [ ] 切割音频和视频时可以实时预览
- [ ] 转码核心代码优化
- [ ] 提供可以让用户输入 ffmpeg 命令的形式执行转码操作（目前基本可以实现）
- [ ] 界面优化
- [ ] 用户可选保持原始目录路径
- [ ] 加入文件夹监控，自动队列转码（支持数据库和 webhook）
- [ ] 下载 M3u8 的链接
- [ ] 批量转码（指定线程池数量来优化性能）

### 构建应用

```bash
# 安装依赖
npm install

# 热加载服务运行在 localhost: 9080
npm run dev

# 打包项目
npm run build
```

### 赞助我

如果觉得这些内容不错，请我喝杯咖啡吧。

![pay](./screenshot/pay.png)
