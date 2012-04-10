// ==========================================================================
// Project:   xTuple PostBooks - xTuple Business Management Framework
// Copyright: ©2011 OpenMFG LLC, d/b/a xTuple
// ==========================================================================
/*globals XT */

sc_require('ext/dispatch');
sc_require('delegates/session_delegate');

/**
  @instance
  @extends SC.Object
*/
XT.session = SC.Object.create(
  /** @lends XT.Session.prototype */ {

  //...........................................
  // METHODS
  //

  /**
  */
  acquireSession: function(username, password, organization, forceNew) {

    // retrieve the session delegate (if one was set or the default empty
    // one if not)
    var delegate = this.get('delegate');

    // this is just a parameter-hash to send to the datasource
    var session = {
      username: username,
      password: password,
      organization: organization,
      forceNew: !! forceNew
    };

    // get the socket to the datasource
    var socket = this.get('socket');

    if (!socket) throw "Cannot communicate with datasource via socket " +
      "to request a session, socket not available";

    // let the delegate know we're about to request a new session
    delegate.willAcquireSession(session);

    // send the request
    socket.json.emit('requestSession', session);
  },

  //...........................................
  // SOCKET
  //

  /** 
  */
  _xt_socket: null,

  /**
  */
  _xt_socketIsEnabled: false,

  /**
  */
  socket: function() {
    var enabled = this.get('_xt_socketIsEnabled');
    return enabled ? this.get('_xt_socket') : null;
  }.property('_xt_socketIsEnabled').cacheable(),

  //
  // END SOCKET
  //...........................................

  //...........................................
  // PROPERTIES
  //

  /**
    The session delegate receives calls on specific
    events related to the session.

    @property
    @default XT.SessionDelegate
  */
  delegate: XT.SessionDelegate,

  SETTINGS:         0x01,
  PRIVILEGES:       0x02,
  LOCALE:           0x04,
  ALL:              0x01 | 0x02 | 0x04,

  /** @private */
  store: function() {
    return XT.store;
  }.property().cacheable(),

  /**
    Loads session objects for settings, preferences and privileges into local
    memory. Types `XT.session.SETTINGS`, `XT.session.LOCALE` or types
    `XT.session.PRIVILEGES` can be passed as bitwise operators. If no
    arguments are passed the default is `XT.session.ALL` which will load all
    session objects.
  */
  loadSessionObjects: function(types) {
    var self = this,
        store = this.get('store'),
        dispatch, callback;

    if (types === undefined) types = this.ALL;

    if (types & this.PRIVILEGES) {
      dispatch = XT.Dispatch.create({
        className: 'XT.Session',
        functionName: 'privileges',
        target: self,
        action: self.didFetchPrivileges
      });

      store.dispatch(dispatch);
    }

    if (types & this.SETTINGS) {
      dispatch = XT.Dispatch.create({
        className: 'XT.Session',
        functionName: 'settings',
        target: self,
        action: self.didFetchSettings
      });

      store.dispatch(dispatch);
    }

    if (types & this.LOCALE) {
      dispatch = XT.Dispatch.create({
        className: 'XT.Session',
        functionName: 'locale',
        target: self,
        action: self.didFetchLocale
      });

      store.dispatch(dispatch);
    }

    return true;
  },

  didFetchSettings: function(error, response) {
    // Create an object for settings.
    var that = this,
        settings = SC.Object.create({
          // Return false if property not found
          get: function(key) {
            for (var prop in this) {
              if (prop === key) return this[prop];
            }

            return false;
          },

          set: function(key, value) {
            this.get('changed').push(key);

            arguments.callee.base.apply(this, arguments);
          },

          changed: []
        });

    // Loop through the response and set a setting for each found
    response.forEach(function(item) {
      settings.set(item.setting, item.value);
    });

    settings.set('changed', []);

    // Attach the settings to the session object
    this.set('settings', settings);

    return true;
  },

  didFetchPrivileges: function(error, response) {
    // Create a special object for privileges where the get function returns
    // `false` if it can't find the key.
    var privileges = SC.Object.create({
      get: function(key) {
        if (typeof key === 'boolean') return key;

        for (var prop in this) {
          if (prop === key) return this[prop];
        }

        return false;
      }
    });

    // Loop through the response and set a privilege for each found.
    response.forEach(function(item) {
      privileges.set(item.privilege, item.isGranted);
    });

    // Attach the privileges to the session object.
    this.set('privileges', privileges);

    return true;
  },

  didFetchLocale: function(error, response) {
    // Attach the locale to the session object.
    this.set('locale', response);

    return true;
  },

  /** @private */
  init: function() {

    // boring normal stuff
    arguments.callee.base.apply(this, arguments);

    var self = this;

    // grab a fucking socket now thats interesting!
    // the socket.io package is loaded inlined so
    // we know its available, go ahead and setup the
    // socket we want for session communication

    // this...is ugly...?
    XT.ready(function() {

      // TODO: The underlying node datasource url will have to be exposed...
      var socket = io.connect(/** REPLACE ME */ 'http://localhost:9000' + '/session');

      // provide an update mechanism...
      socket.on('connect', function() {
        self.set('_xt_socketIsEnabled', true);
      });

      // set the property for future reference
      self._xt_socket = socket;
    });
  },

});
