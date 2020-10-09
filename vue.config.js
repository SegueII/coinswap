module.exports = {
    devServer: {
        https: true,
        port: 8081,
        proxy: {
            '/api': {
                target: 'http://10.1.4.201:1317',
                changeOrigin: true,
                pathRewrite: {
                    '^/api': ''
                }
            }
        }
    }
}
