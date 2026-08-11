# FFmpeg GUI

### 项目说明

FFmpeg GUI 是一款基于 electron-react-boilerplate 开发的现代化图形界面应用程序，旨在简化 FFmpeg 的使用流程。本应用为用户提供了一个直观、高效的界面，使复杂的音视频转换和处理任务变得轻而易举。

### 主要功能

- 输入 FFmpeg 命令行参数，应用程序将自动执行相应的音视频转换任务。
- 支持大部分标准 FFmpeg 命令选项。

### 项目截图

![screenshot1](https://raw.githubusercontent.com/zhen-ke/img/main/IMG_2024-10-15-11-06.jpg)
![screenshot2](https://raw.githubusercontent.com/zhen-ke/img/main/IMG_2024-10-15-11-08.jpg)
![IMG_2026-08-11-16-26-19-1.webp](https://cdn.jsdelivr.net/gh/zhen-ke/img@main/202606/IMG_2026-08-11-16-26-19-1.webp)
![IMG_2026-08-11-16-26-23-2.webp](https://cdn.jsdelivr.net/gh/zhen-ke/img@main/202606/IMG_2026-08-11-16-26-23-2.webp)

### 注意事项

- 首次启动时，应用程序会自动检查 FFmpeg 是否可用。
- 请确保有足够的磁盘空间用于输出文件。
- 对于大文件转换，可能需要较长处理时间，请耐心等待。

### 构建应用

```bash
# 安装依赖
npm install

# 开发模式
npm run start

# 打包项目
npm run package
```

#### 启动报错时（原生模块架构不匹配）

```bash
npm run rebuild:pty
```

### 赞助我

如果觉得这些内容不错，请我喝杯咖啡吧。

![pay](https://raw.githubusercontent.com/zhen-ke/img/main/pay.png)
