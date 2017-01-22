/*
* Moon 0.1.3
* Copyright 2016-2017, Kabir Shah
* https://github.com/KingPixil/moon/
* Free to use under the MIT license.
* https://kingpixil.github.io/license
*/

(function(root, factory) {
  /* ======= Global Moon ======= */
  (typeof module === "object" && module.exports) ? module.exports = factory() : root.Moon = factory();
}(this, function() {

    /* ======= Global Variables ======= */
    var directives = {};
    var components = {};
    var id = 0;

    /* ======= Global Utilities ======= */
    
    /**
     * Creates a Virtual DOM Node
     * @param {String} type
     * @param {String} val
     * @param {Object} props
     * @param {Array} children
     * @param {Object} meta
     * @return {Object} Virtual DOM Node
     */
    var createElement = function(type, val, props, children, meta) {
      return {
        type: type,
        val: val,
        props: props,
        children: children,
        meta: meta || {
          shouldRender: true
        }
      };
    }
    
    /**
     * Compiles JSX to Virtual DOM
     * @param {String} tag
     * @param {Object} attrs
     * @param {Array} children
     * @return {String} Object usable in Virtual DOM
     */
    var h = function() {
      var args = Array.prototype.slice.call(arguments);
      var tag = args.shift();
      var attrs = args.shift() || {};
      var children = args;
      if(typeof children[0] === "string") {
        children[0] = createElement("#text", children[0], {}, [], defaultMeta())
      }
      return createElement(tag, children.join(""), attrs, children, defaultMeta());
    };
    
    /**
     * Compiles Template to Render Function
     * @param {String} template
     * @return {Function} Render Function
     */
    var createRender = function(template) {
      console.log('return "' + template.replace(/"/g, '\\"') + '"')
      return new Function('return "' + template.replace(/"/g, '\\"') + '"');
    }
    
    /**
     * Merges two Objects
     * @param {Object} obj
     * @param {Object} obj2
     * @return {Object} Merged Objects
     */
    function merge(obj, obj2) {
      for (var key in obj2) {
        if (obj2.hasOwnProperty(key)) obj[key] = obj2[key];
      }
      return obj;
    }
    
    /**
     * Does No Operation
     */
    var noop = function() {
    
    }
    

    function Moon(opts) {
        /* ======= Initial Values ======= */
        this.$opts = opts || {};

        var self = this;
        var _data = this.$opts.data;

        this.$id = id++;

        this.$render = this.$opts.render || noop;
        this.$hooks = merge({created: noop, mounted: noop, updated: noop, destroyed: noop}, this.$opts.hooks);
        this.$methods = this.$opts.methods || {};
        this.$components = merge(this.$opts.components || {}, components);
        this.$directives = merge(this.$opts.directives || {}, directives);
        this.$events = {};
        this.$dom = {};
        this.$destroyed = false;

        /* ======= Listen for Changes ======= */
        Object.defineProperty(this, '$data', {
            get: function() {
                return _data;
            },
            set: function(value) {
                _data = value;
                this.build(this.$dom.children);
            },
            configurable: true
        });

        /* ======= Default Directives ======= */
        directives[Moon.config.prefix + "if"] = function(el, val, vdom) {
          var evaluated = new Function("return " + val);
          if(!evaluated()) {
            for(var i = 0; i < vdom.children.length; i++) {
              vdom.children[i].node.textContent = "";
              vdom.children[i].meta.shouldRender = false;
            }
          } else {
            for(var i = 0; i < vdom.children.length; i++) {
              vdom.children[i].meta.shouldRender = true;
            }
          }
        }
        
        directives[Moon.config.prefix + "show"] = function(el, val, vdom) {
          var evaluated = new Function("return " + val);
          if(!evaluated()) {
            el.style.display = 'none';
          } else {
            el.style.display = 'block';
          }
        }
        
        directives[Moon.config.prefix + "on"] = function(el, val, vdom) {
          var splitVal = val.split(":");
          var eventToCall = splitVal[0];
          var methodToCall = splitVal[1];
          if(self.$events[eventToCall]) {
            self.on(eventToCall, methodToCall);
          } else {
            el.addEventListener(eventToCall, function(e) {
              self.callMethod(methodToCall, [e]);
            });
          }
          delete vdom.props[Moon.config.prefix + "on"];
        }
        
        directives[Moon.config.prefix + "model"] = function(el, val, vdom) {
          el.value = self.get(val);
          el.addEventListener("input", function() {
            self.set(val, el.value);
          });
          delete vdom.props[Moon.config.prefix + "model"];
        }
        
        directives[Moon.config.prefix + "for"] = function(el, val, vdom) {
          var parts = val.split(" in ");
          var alias = parts[0];
          var array = self.get(parts[1]);
        }
        
        directives[Moon.config.prefix + "once"] = function(el, val, vdom) {
          vdom.meta.shouldRender = false;
        }
        
        directives[Moon.config.prefix + "text"] = function(el, val, vdom) {
          el.textContent = val;
        }
        
        directives[Moon.config.prefix + "html"] = function(el, val, vdom) {
          el.innerHTML = val;
        }
        
        directives[Moon.config.prefix + "mask"] = function(el, val, vdom) {
        
        }
        

        /* ======= Initialize 🎉 ======= */
        this.init();
    }

    /* ======= Instance Methods ======= */
    
    /**
     * Logs a Message
     * @param {String} msg
     */
    Moon.prototype.log = function(msg) {
      if(!Moon.config.silent) console.log(msg);
    }
    
    /**
     * Throws an Error
     * @param {String} msg
     */
    Moon.prototype.error = function(msg) {
      console.error("[Moon] ERR: " + msg);
    }
    
    /**
     * Gets Value in Data
     * @param {String} key
     * @return {String} Value of key in data
     */
    Moon.prototype.get = function(key) {
      return this.$data[key];
    }
    
    /**
     * Sets Value in Data
     * @param {String} key
     * @param {String} val
     */
    Moon.prototype.set = function(key, val) {
      this.$data[key] = val;
      if(!this.$destroyed) this.build();
      this.$hooks.updated();
    }
    
    /**
     * Destroys Moon Instance
     */
    Moon.prototype.destroy = function() {
      Object.defineProperty(this, '$data', {
        set: function(value) {
          _data = value;
        }
      });
      this.removeEvents();
      this.$destroyed = true;
      this.$hooks.destroyed();
    }
    
    /**
     * Calls a method
     * @param {String} method
     */
    Moon.prototype.callMethod = function(method, args) {
      args = args || [];
      this.$methods[method].apply(this, args);
    }
    
    // Event Emitter, adapted from https://github.com/KingPixil/voke
    
    /**
     * Attaches an Event Listener
     * @param {String} eventName
     * @param {Function} action
     */
    Moon.prototype.on = function(eventName, action) {
      if(this.$events[eventName]) {
        this.$events[eventName].push(action);
      } else {
        this.$events[eventName] = [action];
      }
    }
    
    /**
     * Removes an Event Listener
     * @param {String} eventName
     * @param {Function} action
     */
    Moon.prototype.off = function(eventName, action) {
      var index = this.$events[eventName].indexOf(action);
      if(index !== -1) {
        this.$events[eventName].splice(index, 1);
      }
    }
    
    /**
     * Removes All Event Listeners
     * @param {String} eventName
     * @param {Function} action
     */
    Moon.prototype.removeEvents = function() {
      for(var evt in this.$events) {
        this.$events[evt] = [];
      }
    }
    
    /**
     * Emits an Event
     * @param {String} eventName
     * @param {Object} meta
     */
    Moon.prototype.emit = function(eventName, meta) {
      meta = meta || {};
      meta.type = eventName;
    
      if(this.$events["*"]) {
        for(var i = 0; i < this.$events["*"].length; i++) {
          var globalHandler = this.$events["*"][i];
          globalHandler(meta);
        }
      }
    
      for(var i = 0; i < this.$events[eventName].length; i++) {
        var handler = this.$events[eventName][i];
        handler(meta);
      }
    }
    
    /**
     * Mounts Moon Element
     * @param {Object} el
     */
    Moon.prototype.mount = function(el) {
      this.$el = document.querySelector(el);
    
      if(!this.$el) {
        this.error("Element " + this.$opts.el + " not found");
      }
    
      this.$template = this.$opts.template || this.$el.innerHTML;
    
      this.$el.innerHTML = this.$template;
    
      if(this.$render === noop) {
        this.$render = createRender(this.$template);
      }
    
      this.build();
      this.$hooks.mounted();
    }
    
    /**
     * Renders Virtual DOM
     * @return Virtual DOM
     */
    Moon.prototype.render = function() {
      return this.$render(h);
    }
    
    /**
     * Diff then Patches Nodes With Data
     * @param {Object} node
     * @param {Object} vnode
     */
    Moon.prototype.patch = function(node, vnode) {
    
    }
    
    /**
     * Render and Patches the DOM With Data
     */
    Moon.prototype.build = function() {
      this.$dom = this.render();
      this.patch(this.$el, this.$dom);
    }
    
    /**
     * Initializes Moon
     */
    Moon.prototype.init = function() {
      this.log("======= Moon =======");
      this.$hooks.created();
    
      if(this.$opts.el) {
        this.mount(this.$opts.el);
      }
    }
    

    /* ======= Global API ======= */
    
    /**
     * Configuration of Moon
     */
    Moon.config = {
      silent: false,
      prefix: "m-"
    }
    
    /**
     * Runs an external Plugin
     * @param {Object} plugin
     */
    Moon.use = function(plugin) {
      plugin.init(Moon);
    }
    
    /**
     * Creates a Directive
     * @param {String} name
     * @param {Function} action
     */
    Moon.directive = function(name, action) {
      directives[Moon.config.prefix + name] = action;
    }
    
    /**
     * Creates a Component
     * @param {String} name
     * @param {Function} action
     */
    Moon.component = function(name, opts) {
      var Parent = this;
      function MoonComponent() {
        Moon.call(this, opts);
      }
      MoonComponent.prototype = Object.create(Parent.prototype);
      MoonComponent.prototype.constructor = MoonComponent;
      var component = new MoonComponent();
      components[name] = component;
      return component;
    }
    

    return Moon;
}));
