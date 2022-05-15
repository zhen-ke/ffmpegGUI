# ffmpegGUI

### 项目说明

ffmpeg-gui 是一个基于 tauri 框架开发的跨平台软件，可以用它做视频音频转码、视频音频合并、视频转 GIF 等功能

### 项目截图

![screenshot1](./screenshot/ffmpeg_07.gif)

### 遇到的问题

- 如何开启硬件加速
- 打包后 electron 里 asar 不能使用二进制文件的问题
- 如何通过 Webpack 打包不同平台的二进制文件到 APP 里

[上述问题的解决过程](https://zhen-ke.github.io/2019/06/17/ffmpeggui-development-notes/)

### 待完善

- [x] 减小打包过大的问题（目前默认是打包全平台的 ffmpeg）
- [ ] 增加配置项（目前所有的配置默认都是写死的，比如转视频时默认会把任意格式的视频转 MP4）
- [ ] 切割音频和视频时可以实时预览
- [x] 转码核心代码优化
- [x] 提供可以让用户输入 ffmpeg 命令的形式执行转码操作（目前基本可以实现）
- [ ] 界面优化
- [ ] 用户可选保持原始目录路径
- [ ] 加入文件夹监控，自动队列转码（支持数据库和 webhook）
- [ ] 下载 M3u8 的链接
- [ ] 批量转码（指定线程池数量来优化性能）

### 构建应用

```bash
# 安装依赖
npm install

# 开发模式
npm run electron:serve

# 打包项目
npm run electron:build
```

### 赞助我

如果觉得这些内容不错，请我喝杯咖啡吧。

![pay](./screenshot/pay.png)
