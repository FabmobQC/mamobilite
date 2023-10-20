/*
 * We think that a common pattern is to generate a prompt to notify the user
 * about something and then to re-route them to the appropriate tab. An
 * existing example is the notification prompt. So let's write a standard
 * factory to make that easier.
 */

angular.module('emission.splash.localnotify', ['emission.plugin.logger',
                                              'emission.services',
                                              'emission.splash.startprefs'])
.factory('LocalNotify', function($window, $ionicPlatform, $ionicPopup,
    $translate, UserCacheHelper,
    $state, $rootScope, Logger) {
  var localNotify = {};

  /*
   * Return the state to redirect to, undefined otherwise
   */
  localNotify.getRedirectState = function(notification) {
    // TODO: Think whether this should be in data or in category
    if (angular.isDefined(notification.data)) {
      return [notification.data.redirectTo, notification.data.redirectParams];
    }
    return undefined;
  }

  localNotify.handleLaunch = function(targetState, targetParams) {
    $rootScope.redirectTo = targetState;
    $rootScope.redirectParams = targetParams;
    $state.go(targetState, targetParams, { reload : true });
  }

  localNotify.handlePrompt = function(notification, targetState, targetParams) {
    Logger.log("Prompting for notification "+notification.title+" and text "+notification.text);
    var promptPromise = $ionicPopup.show({title: notification.title,
        template: notification.text,
        buttons: [{
          text: 'Handle',
          type: 'button-positive',
          onTap: function(e) {
            // e.preventDefault() will stop the popup from closing when tapped.
            return true;
          }
        }, {
          text: 'Ignore',
          type: 'button-positive',
          onTap: function(e) {
            return false;
          }
        }]
    });
    promptPromise.then(function(handle) {
      if (handle == true) {
        localNotify.handleLaunch(targetState, targetParams);
      } else {
        Logger.log("Ignoring notification "+notification.title+" and text "+notification.text);
      }
    });
  }

  localNotify.handleNotification = function(notification,state,data) {
    // Comment this out for ease of testing. But in the real world, we do in fact want to 
    // cancel the notification to avoid "hey! I just fixed this, why is the notification still around!"
    // issues
    // $window.cordova.plugins.notification.local.cancel(notification.id);
    var [targetState, targetParams] = localNotify.getRedirectState(notification);
    Logger.log("targetState = "+targetState);
    if (angular.isDefined(targetState)) {
      if (state.foreground == true) {
        localNotify.handlePrompt(notification, targetState, targetParams);
      } else {
        localNotify.handleLaunch(targetState, targetParams);
      }
    }
  }

  localNotify.registerRedirectHandler = function() {
    Logger.log( "registerUserResponse received!" );
    $window.cordova.plugins.notification.local.on('action', function (notification, state, data) {
      localNotify.handleNotification(notification, state, data);
    });
    $window.cordova.plugins.notification.local.on('clear', function (notification, state, data) {
        // alert("notification cleared, no report");
    });
    $window.cordova.plugins.notification.local.on('cancel', function (notification, state, data) {
        // alert("notification cancelled, no report");
    });
    $window.cordova.plugins.notification.local.on('trigger', function (notification, state, data) {
      localNotify.handleNotification(notification, state, data);
    });
    $window.cordova.plugins.notification.local.on('click', function (notification, state, data) {
      localNotify.handleNotification(notification, state, data);
    });
  }


  function scheduleNotification(notification, currentMoment, displayMoment) {

    if (currentMoment.isAfter(displayMoment)) {
      return;
    }

    const language = $translate.use();
    const titles = notification.titles;
    const title = titles.find((title) => title.language === language) || titles[0]

    const messages = notification.messages;
    const message = messages.find((message) => message.language === language) || messages[0]

    $window.cordova.plugins.notification.local.schedule({
      id: notification.id,
      title: title.title,
      text: message.body,
      trigger: { at: displayMoment.toDate() }
    });
  }
  
  localNotify.setNotifications = function(config) {
    // We're not sure whether old notifications are still active or not
    // We might also want someday to update the config and remove notifications
    $window.cordova.plugins.notification.local.cancelAll();

    const creationMoment = moment(config.date_joined)
    const currentMoment = new moment();

    const onInstallNotifications = config.on_install_notifications;
    onInstallNotifications.forEach((notification) => {
      const displayMoment = creationMoment.add(notification.delay, notification.delay_unit)
      scheduleNotification(notification, currentMoment, displayMoment);
    })


    const configTimezone = config.timezone;
    const creationDate = creationMoment.tz(configTimezone).startOf('day'); // setting to 00:00 in config's timezone
    const dailyNotifications = config.daily_notifications;
    dailyNotifications.forEach((notification) => {
      const creationDateClone = moment(creationDate); // moments are mutable
      const displayTime = moment.duration(notification.display_time)
      const displayMoment = creationDateClone.add(notification.day, "days").add(displayTime)
      scheduleNotification(notification, currentMoment, displayMoment);
    });
  }

  $ionicPlatform.ready().then(function() {
    localNotify.registerRedirectHandler();
    Logger.log("finished registering handlers, about to fire queued events");
    $window.cordova.plugins.notification.local.fireQueuedEvents();
  });

  return localNotify;    
});
