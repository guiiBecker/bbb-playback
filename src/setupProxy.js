const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
    const target = process.env.PROXY_HOST;
    if (!target) return;

    // The recordings' files, and the video format's: the redesigned player's
    // master MP4 (studio/master.js) is at /playback/video/<record id>/
    app.use(
        ['/presentation', '/playback/video'],
        createProxyMiddleware({
            target,
            changeOrigin: true,
            secure: false,
        })
    );
};
