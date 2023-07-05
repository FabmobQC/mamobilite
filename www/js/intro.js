'use strict';

angular.module('emission.intro', ['emission.splash.startprefs',
                                  'emission.survey.enketo.demographics',
                                  'emission.appstatus.permissioncheck',
                                  'emission.i18n.utils',
                                  'emission.config.dynamic',
                                  'emission.services',
                                  'ionic-toast'])

.config(function($stateProvider) {
  $stateProvider
  // setup an abstract state for the intro directive
    .state('root.intro', {
    url: '/intro',
    templateUrl: 'templates/intro/intro.html',
    controller: 'IntroCtrl'
  })
  .state('root.reconsent', {
    url: '/reconsent',
    templateUrl: 'templates/intro/reconsent.html',
    controller: 'IntroCtrl'
  });
})

.controller('IntroCtrl', function($scope, $rootScope, $state, $window,
    $ionicPlatform, $ionicSlideBoxDelegate,
    UserCacheHelper, DynamicConfig, $translate,
    $ionicPopup, $ionicHistory, ionicToast, $timeout, CommHelper, StartPrefs, SurveyLaunch, i18nUtils) {

  var allIntroFiles = Promise.all([
    i18nUtils.geti18nFileName("templates/", "intro/summary", ".html"),
    i18nUtils.geti18nFileName("templates/", "intro/consent", ".html"),
    i18nUtils.geti18nFileName("templates/", "intro/sensor_explanation", ".html"),
    i18nUtils.geti18nFileName("templates/", "intro/login", ".html"),
    i18nUtils.geti18nFileName("templates/", "intro/survey", ".html")
  ]);
  allIntroFiles.then(function(allIntroFilePaths) {
    $scope.$apply(function() {
      console.log("intro files are "+allIntroFilePaths);
      $scope.summaryFile = allIntroFilePaths[0];
      $scope.consentFile = allIntroFilePaths[1];
      $scope.explainFile = "templates/intro/sensor_explanation.html";
      $scope.loginFile = allIntroFilePaths[3];
      $scope.joinFile = "templates/intro/request_join.html";
    });
  });

  $scope.getIntroBox = function() {
    return $ionicSlideBoxDelegate.$getByHandle('intro-box');
  };

  $scope.stopSliding = function() {
    $scope.getIntroBox().enableSlide(false);
  };

  $scope.showSettings = function() {
    window.cordova.plugins.BEMConnectionSettings.getSettings().then(function(settings) {
      var errorMsg = JSON.stringify(settings);
      var alertPopup = $ionicPopup.alert({
        title: 'settings',
        template: errorMsg
      });

      alertPopup.then(function(res) {
        $scope.next();
      });
    }, function(error) {
        $scope.alertError('getting settings', error);
    });
  };

  $scope.overallStatus = false;

  // Adapted from https://stackoverflow.com/a/63363662/4040267
  // made available under a CC BY-SA 4.0 license

  $scope.generateRandomToken = function(length) {
    var randomInts = window.crypto.getRandomValues(new Uint8Array(length * 2));
    var randomChars = Array.from(randomInts).map((b) => String.fromCharCode(b));
    var randomString = randomChars.join("");
    var validRandomString = window.btoa(randomString).replace(/[+/]/g, "");
    return validRandomString.substring(0, length);
  }

  $scope.disagree = function() {
    $scope.getIntroBox().previous();
  };

  $scope.agree = function() {
    $scope.randomToken = $scope.generateRandomToken(45);
    window.Logger.log("Signing in with random token "+$scope.randomToken);

    StartPrefs.markConsented().then(function(response) {
      $ionicHistory.clearHistory();
      if ($state.is('root.intro')) {
        $scope.next();
      } else {
        StartPrefs.loadPreferredScreen();
      }
    });
  };

  $scope.next = function() {
    $scope.getIntroBox().next();
  };

  $scope.previous = function() {
    $scope.getIntroBox().previous();
  };

  $scope.alertError = function(title, errorResult) {
      var errorMsg = JSON.stringify(errorResult);
      var alertPopup = $ionicPopup.alert({
        title: title,
        template: errorMsg
      });

      alertPopup.then(function(res) {
        window.Logger.log(window.Logger.LEVEL_INFO, errorMsg + ' ' + res);
      });
  }

  $scope.loginNew = function() {
    $scope.choiceIsConfirmed = true;
    $scope.randomToken = $scope.generateRandomToken(16);
    $scope.login($scope.randomToken);
  };


  const emailRegex = /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9]))\.){3}(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9])|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/

  $scope.getUserEmail = function() {
    $scope.data = {};
    const emailPopup = $ionicPopup.show({
        template: `
          <input type="email" ng-model="data.email">
          <br>
          <label>
          ${$translate.instant('intro.join.repeat-email')}
          </label>
          <br>
          <input type="email" ng-model="data.repeatEmail">
        `,
        title: $translate.instant('intro.join.enter-email') + '<br>',
        scope: $scope,
        buttons: [
          {
            text: '<b>' + $translate.instant('intro.join.confirm') + '</b>',
            type: 'button-positive',
            onTap: function(e) {
              if (
                $scope.data.email != $scope.data.repeatEmail
                ||
                !emailRegex.test($scope.data.email)
              ) {
                //don't allow the user to close unless he enters a username

                e.preventDefault();
              } else {
                return $scope.data.email;
              }
            }
          },{
            text: '<b>' + $translate.instant('intro.join.cancel') + '</b>',
            type: 'button-stable',
            onTap: function(e) {
              return null;
            }
          }
        ]
    });
    emailPopup.then(function(email) {
        if (email != null) {
            $scope.email = email;
            $scope.loginNew();
        }
    }).catch(function(err) {
        $scope.alertError(err);
    });
  };

  $scope.scanExisting = function() {
    const EXPECTED_PREFIX = "emission://login_token?token=";
    cordova.plugins.barcodeScanner.scan(
      function (result) {
          if (result.format == "QR_CODE" &&
              result.cancelled == false &&
              result.text.startsWith(EXPECTED_PREFIX)) {
              const extractedToken = result.text.substring(EXPECTED_PREFIX.length, result.length);
              Logger.log("From QR code, extracted token "+extractedToken);
              $scope.login(extractedToken);
          } else {
              $ionicPopup.alert({template: "invalid token format "+result.text});
          }
      },
      function (error) {
          $ionicPopup.alert({template: "Scanning failed: " + error});
      });
  };

  $scope.login = function(token) {
    window.cordova.plugins.OPCodeAuth.setOPCode(token).then(function(opcode) {
      // ionicToast.show(message, position, stick, time);
      // $scope.next();
      ionicToast.show(opcode, 'middle', false, 2500);
      if (opcode == "null" || opcode == "") {
        $scope.alertError("Invalid login "+opcode);
      } else {
        CommHelper.registerUser(function(successResult) {
          CommHelper.updateUser({
            creation_ts: new moment(),
            project_id: $scope.selectedStudy.id,
            email: $scope.email, // we might want not to have email on e-mission-server in order to anonymize data
          });
          if (!$scope.selectedStudy.user_email_mandatory) {
            $scope.startSurvey();
          }
          UserCacheHelper.setEmail($scope.email);
          UserCacheHelper.setCreationTime(new Date());
          $scope.finish();
        }, function(errorResult) {
          $scope.alertError('User registration error', errorResult);
        });
      }
    }, function(error) {
        $scope.alertError('Sign in error', error);
    });
  };

  // Called each time the slide changes
  $scope.slideChanged = function(index) {
    $scope.slideIndex = index;
    /*
     * The slidebox is created as a child of the HTML page that this controller
     * is associated with, so it is not available when the controller is created.
     * There is an onLoad, but it is for ng-include, not for random divs, apparently.
     * Trying to create a new controller complains because then both the
     * directive and the controller are trying to ask for a new scope.
     * So instead, I turn off swiping after the initial summary is past.
     * Since the summary is not legally binding, it is fine to swipe past it...
     */
    if (index > 0) {
        $scope.getIntroBox().enableSlide(false);
    }
  };

  $scope.finish = function() {
    // this is not a promise, so we don't need to use .then
    StartPrefs.markConsented().then(function(response) {
      $ionicHistory.clearHistory();
      StartPrefs.markIntroDone();
      $scope.getIntroBox().slide(0);
      StartPrefs.loadPreferredScreen();
    })
  }

  $ionicPlatform.ready().then(function() {
    console.log("app is launched, currently NOP");
    $scope.getIntroBox().enableSlide(false); // FabMob: We don't want the user to swipe on terms of use
  });

  $scope.startSurvey = function() {
    const frenchForm = {
      userIdElementId: "wpforms-25100-field_14",
      url: "https://fabmobqc.ca/nos-donnees-en-mobilite/ma-mobilite/questionnaire-ma-mobilite/",
    };

    const englishForm = {
      userIdElementId: "wpforms-25278-field_14",
      url: "https://fabmobqc.ca/en/our-mobility-data/my-mobility/my-mobility-questionnaire/",
    };

    const form = ((language) => {
      switch (language) {
        case "fr":
          return frenchForm;
        case "en":
          return englishForm;
        default:
          return englishForm;
      }
    })($translate.use());

    CommHelper.getUser().then(function(userProfile) {
      const fillers = [
        {
          elementId: form.userIdElementId,
          elementValue: userProfile.user_id["$uuid"],
        },
      ];

      SurveyLaunch.startSurveyPrefilled(form.url, fillers);
    });
  };

  $scope.email = null;
  $scope.studies = [];
  $scope.selectedStudy = null;
  $scope.choiceIsConfirmed = false;

  const options = {
    method: 'get',
    responseType: 'json'
  }
  
  cordova.plugin.http.sendRequest("https://www.mamobilite.fabmobqc.ca/api/projects/", options,
  function(response) {
    $scope.studies = response.data;
  }, function(error) {
    Logger.log("Failed to fetch studies " + JSON.stringify(error));
  });

  $scope.selectStudy = function(study) {
    $scope.selectedStudy = study;
  }

  $scope.confirmStudy = function() {

    const downloadURL = "https://www.mamobilite.fabmobqc.ca/api/projects/"+$scope.selectedStudy.id;
    DynamicConfig.loadNewConfig(downloadURL)
    .then(() => {
      if ($scope.selectedStudy.user_email_mandatory) {
        $scope.getUserEmail();
      }
      else {
        $scope.loginNew();
      }
    })
  }

    $scope.name_field = `name_${$translate.use() === 'fr' ? 'fr' : 'en'}`;
});
