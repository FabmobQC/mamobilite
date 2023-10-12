'use strict';


angular.module('emission.config.dynamic', ['emission.plugin.logger', 'emission.splash.localnotify'])
.factory('DynamicConfig', function($http, $ionicPlatform,
        $window, $state, $rootScope, $timeout, Logger, LocalNotify) {
    // also used in the startprefs class
    // but without importing this
    const CONFIG_PHONE_UI="config/app_ui_config";
    const LOAD_TIMEOUT = 6000; // 6000 ms = 6 seconds

    var dc = {};
    dc.UI_CONFIG_READY="UI_CONFIG_READY";
    dc.UI_CONFIG_CHANGED="UI_CONFIG_CHANGED";
    dc.isConfigReady = false;
    dc.isConfigChanged = false;

    dc.configChanged = function() {
        if (dc.isConfigChanged) {
            return Promise.resolve(dc.config);
        } else {
            return new Promise(function(resolve, reject) {
                $rootScope.$on(dc.UI_CONFIG_CHANGED, (event, newConfig) => resolve(newConfig));
            });
        }
    }
    dc.configReady = function() {
        if (dc.isConfigReady) {
            Logger.log("UI_CONFIG in configReady function, resolving immediately");
            return Promise.resolve(dc.config);
        } else {
            Logger.log("UI_CONFIG in configReady function, about to create promise");
            return new Promise(function(resolve, reject) {
                Logger.log("Registering for UI_CONFIG_READY notification in dynamic_config inside the promise");
                $rootScope.$on(dc.UI_CONFIG_READY, (event, newConfig) => {
                    Logger.log("Received UI_CONFIG_READY notification in dynamic_config, resolving promise");
                    resolve(newConfig)
                });
            });
        }
    }

    var readConfigFromServer = function(downloadUrl, options) {
        Logger.log("Downloading data from "+downloadUrl);
        return new Promise(function(resolve, reject) {
            cordova.plugin.http.sendRequest(downloadUrl, options,
            function(response) {
                Logger.log("Successfully found the "+downloadUrl+", result is " + JSON.stringify(response.data).substring(0,10));
                const config = {
                    ...response.data,
                    "connectUrl": response.data.user_server ?? response.data.server_url,
                    "aggregate_call_auth": "no_auth",
                    "android": {
                        "auth": {
                            "method": "prompted-auth",
                            "clientID": "ignored"
                        }
                    },
                    "ios": {
                        "auth": {
                            "method": "prompted-auth",
                            "clientID": "ignored"
                        }
                    },
                    "downloadUrl": downloadUrl,
                };
                resolve(config);
            }, function(error) {
                reject(error);
            });
        });
    }

    dc.loadSavedConfig = function() {
        const nativePlugin = $window.cordova.plugins.BEMUserCache;
        return nativePlugin.getDocument(CONFIG_PHONE_UI, false)
            .then((savedConfig) => {
                if (nativePlugin.isEmptyDoc(savedConfig)) {
                    Logger.log("Found empty saved ui config, returning null");
                    return undefined;
                } else {
                    Logger.log("Found previously stored ui config, returning it");
                    return savedConfig;
                }
            })
            .catch((err) => Logger.displayError("Unable to read saved config", err));
    }

    dc.loadNewConfig = function (downloadedConfig) {
        const storeConfigPromise = $window.cordova.plugins.BEMUserCache.putRWDocument(
            CONFIG_PHONE_UI, downloadedConfig);
        const logSuccess = (storeResults) => Logger.log("UI_CONFIG: Stored dynamic config successfully, result = "+JSON.stringify(storeResults));
        // loaded new config, so it is both ready and changed
        return storeConfigPromise.then(logSuccess)
            .then(dc.saveAndNotifyConfigChanged(downloadedConfig))
            .then(dc.saveAndNotifyConfigReady(downloadedConfig))
            .then(() => {
                LocalNotify.setNotifications(downloadedConfig);
                return true;
            })
            .catch((storeError) => Logger.displayError("Error storing downloaded study configuration", storeError));
    }

    dc.loadConfigAnonymously = async function(projectId) {
        if (projectId === null) {
            return
        }
        const downloadUrl = `https://www.mamobilite.fabmobqc.ca/api/get_project_cfg/${projectId}`
        const options = {
            method: 'get',
            responseType: 'json'
        }
        const config = await readConfigFromServer(downloadUrl, options)
        dc.loadNewConfig(config, config.version)
        return config
    }

    dc.loadConfigWithCredentials= async function(data) {
        if (data === null) {
            return
        }
        const downloadUrl = "https://www.mamobilite.fabmobqc.ca/api/users/"
        const options = {
            method: 'post',
            data: data,
            responseType: 'json'
        }
        const config = await readConfigFromServer(downloadUrl, options)
        dc.loadNewConfig(config)
        return config
    }

    dc.loadConfigWithLogin= async function(data) {
        if (data === null) {
            return
        }
        const downloadUrl = "https://www.mamobilite.fabmobqc.ca/api/login/"
        const options = {
            method: 'POST',
            data: data,
            responseType: 'json'
        }
        const config = await readConfigFromServer(downloadUrl, options)
        dc.loadNewConfig(config)
        return config
    }

    dc.saveAndNotifyConfigReady = function(newConfig) {
        dc.config = newConfig;
        dc.isConfigReady = true;
        console.log("Broadcasting event "+dc.UI_CONFIG_READY);
        $rootScope.$broadcast(dc.UI_CONFIG_READY, newConfig);
    }

    dc.saveAndNotifyConfigChanged = function(newConfig) {
        dc.config = newConfig;
        dc.isConfigChanged = true;
        console.log("Broadcasting event "+dc.UI_CONFIG_CHANGED);
        $rootScope.$broadcast(dc.UI_CONFIG_CHANGED, newConfig);
    }

    dc.initAtLaunch = function () {
        dc.loadSavedConfig().then((existingConfig) => {
            if (!existingConfig) {
                return Logger.log("UI_CONFIG: No existing config, skipping");
            }
            // if 'autoRefresh' is set, we will check for updates
            if (existingConfig.autoRefresh) {
                loadNewConfig(existingConfig.downloadUrl, false, existingConfig.version)
                    .then((wasUpdated) => {
                        if (!wasUpdated) {
                            // config was not updated so we will proceed with existing config
                            $rootScope.$evalAsync(() => dc.saveAndNotifyConfigReady(existingConfig));
                        }
                    }).catch((fetchErr) => {
                        // if we can't check for an updated config, we will proceed with the existing config
                        Logger.log("UI_CONFIG: Unable to check for update, skipping", fetchErr);
                        $rootScope.$evalAsync(() => dc.saveAndNotifyConfigReady(existingConfig));
                    });
            } else {
                Logger.log("UI_CONFIG: autoRefresh is false, not checking for updates. Using existing config")
                $rootScope.$apply(() => dc.saveAndNotifyConfigReady(existingConfig));
                LocalNotify.setNotifications(existingConfig);
            }
        }).catch((err) => {
            Logger.displayError("Error loading config on app start", err)
        });
    };
    $ionicPlatform.ready().then(function() {
        dc.initAtLaunch();
    });
    return dc;
});
