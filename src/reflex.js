/**
    Copyright (c) 2017 Grigory Ponomar

    This program is free software; you can redistribute it and/or
    modify it under the terms of the GNU General Public License
    as published by the Free Software Foundation; either version 2
    of the License, or (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details (http://www.gnu.org).
*/

(function() {
    /**
     * Defaults
     */
    var banned_inputs = '[type=button],[type=submit],[type=reset],[type=image],[type=file],[type=radio],[type=checkbox]';
    var defaultOptions = {
        'data': {},
        'libs': new FuncScope(Expression.libs),
        'inputs': function(instance, target) {
            var inputs = [];
            var inputsByName = {};
            var name;
            $(target.get(0).elements).filter(':not([data-reflex-ignore])').each(function() {
                name = $(this).attr('name');
                if (name) {
                    if (name in inputsByName) {
                        inputsByName[name].push(this);
                    } else {
                        inputsByName[name] = [this];
                    }
                }
            });
            for (name in inputsByName) {
                var input = instance.createInput($(inputsByName[name]));
                if (input) {
                    inputs.push(input);
                }
            }
            return inputs;
        },
        'inputFactories': [
            {'type': 'radio', 'fn': function(instance, target) {
                if (target.is('input[type=radio]')) {
                    return new RadioInput(target);
                }
                return false;
            }},
            {'type': 'checkboxes', 'fn': function(instance, target) {
                if (target.length > 1 && target.is('input[type=checkbox]')) {
                    return new MultiCheckboxInput(target);
                }
                return false;
            }},
            {'type': 'checkbox', 'fn': function(instance, target) {
                if (target.length == 1 && target.is('input[type=checkbox]')) {
                    return new CheckboxInput(target);
                }
                return false;
            }},
            {'type': 'select', 'fn': function(instance, target) {
                if (target.length == 1 && target.is('select:not([multiple])')) {
                    return new Input(target);
                }
                return false;
            }},
            {'type': 'multiselect', 'fn': function(instance, target) {
                if (target.length == 1 && target.is('select[multiple]')) {
                    return new MultiSelectInput(target);
                }
                return false;
            }},
            {'type': 'array', 'fn': function(instance, target) {
                if (target.length > 1 && target.is('select,textarea,input:not(' + banned_inputs + ')')) {
                    return new MultiInput(target);
                }
                return false;
            }},
            {'type': 'default', 'fn': function(instance, target) {
                if (target.length == 1 && target.is('textarea,input:not(' + banned_inputs + ')')) {
                    return new Input(target);
                }
                return false;
            }}
        ],
        'reflexes': {
            'value': function(instance, input, value) {
                input.set(value);
                instance.refresh(input.name);
            },
            'visible': function(instance, input, value) {
                if (value) {
                    input.show();
                } else {
                    input.hide();
                }
            },
            'enabled': function(instance, input, value) {
                if (value) {
                    input.enable();
                } else {
                    input.disable();
                }
            },
            'exists': function(instance, input, value) {
                if (value) {
                    input.restore();
                } else {
                    input.remove();
                }
            }
        },
        'reflexSeparator': ';;'
    };
    /**
     * Helpers
     */ 
    function simplify(src, dest, prefix) {
        prefix = prefix || '';
        for (var key in src) {
            var value = src[key];
            if (typeof value == 'object' && !$.isArray(value)) {
                simplify(value, dest, prefix + key + '.');
            } else {
                dest[prefix + key] = value;
            }
        }
    }
    
    function complicate(data) {
        var result = {};
        var ptr, i, path, k;
        for (var key in data) {
            ptr = result;
            path = key.split('.');
            for (i = 0; i < path.length - 1; i++) {
                k = path[i];
                if (ptr[k] === undefined) {
                    ptr[k] = {};
                }
                ptr = ptr[k];
            }
            ptr[path[path.length - 1]] = data[key];
        }
        return result;
    }
    
    /**
     * Reflectable
     */ 
    var Reflectable = function(target, options) {
        this.options = $.extend({}, defaultOptions, options || {});
        this.target = $(target);
        this.inputs = new InputCollection(this);
        this.statics = [];
        this.reflexes = [];
        this._collectInputs(this.target);
        this._collectReflexes(this.target);
        this.refresh();
    }
    
    Reflectable.prototype._collectInputs = function(target) {
        var inputs = this.options.inputs(this, target);
        for (var i = 0; i < inputs.length; i++) {
            this.inputs.add(inputs[i]);
        }
    }
    
    Reflectable.prototype._collectReflexes = function(target) {
        var that = this;
        var elements = target.find('[data-reflex]');
        elements.each(function() {
            var input = that.inputs.findByElement(this);
            var reflexes = $(this).attr('data-reflex').split(that.options.reflexSeparator);
            if (false == input) {
                input = new StaticElement(this);
                that.statics.push(input);
            }
            for (var i = 0; i < reflexes.length; i++) {
                var colon = reflexes[i].indexOf(':');
                if (colon != -1) {
                    var type = $.trim(reflexes[i].substring(0, colon));
                    if (type in that.options.reflexes) {
                        var expr = reflexes[i].substring(colon + 1);
                        that.reflexes.push(new Reflex(that, input, expr, that.options.reflexes[type]));
                    }
                }
            }
        });
    }
    
    Reflectable.prototype.createInput = function(element) {
        for (var i = 0; i < this.options.inputFactories.length; i++) {
            var input = this.options.inputFactories[i].fn(this, element);
            if (input !== false) {
                return input;
            }
        }
        return false;
    }
    
    Reflectable.prototype.populate = function(data) {
        var flat = {};
        simplify(data, flat);
        for (var key in flat) {
            this.set(key, flat[key]);
        }
    }
    
    Reflectable.prototype.set = function(name, val) {
        this.inputs.set(name, val);
        this.refresh(name);
    }
    
    Reflectable.prototype.get = function(name) {
        return this.inputs.get(name);
    }
    
    Reflectable.prototype.getAll = function() {
        return complicate(this.inputs.getAll());
    }
    
    Reflectable.prototype.refresh = function(name) {
        var i;
        for (i = 0; i < this.reflexes.length; i++) {
            if (name === undefined || this.reflexes[i].dependsOn(name)) {
                this.reflexes[i].trigger();
            }
        }
    }
    
    Reflectable.prototype.addReflex = function(name, expression, reaction) {
        var input = this.inputs.getInput(name);
        if (input) {
            this.reflexes.push(new Reflex(this, input, expression, reaction));
        }
    }
    
    /**
     * Reflex
     */
    var Reflex = function(owner, input, expression, reaction) {
        this.owner = owner;
        this.input = input;
        this.value = undefined;
        this.reaction = reaction;
        this.expression = new Expression(expression, owner.inputs, owner.options.libs);
        this.deps = [];
        this.active = false;
        for (var i = 0; i < this.expression.expr.length; i++) {
            this._collectDeps(this.expression.expr[i]);
        }
    }
    
    Reflex.prototype._collectDeps = function(node) {
        var i;
        switch (node[0]) {
            case 'var':
                this.deps.push(node[1]);
                break;
                
            case 'func':
                for (i = 0; i < node[2].length; i++) {
                    this._collectDeps(node[2][i]);
                }
                break;
                
            case 'neg': 
            case 'not':
            case '()':
                this._collectDeps(node[1]);
                break;
                
            case ':=':
                this._collectDeps(node[2]);
                break;
                
            case '+':
            case '-':
            case '*':
            case '/':
            case 'or':
            case 'and':
                for (i = 1; i < node.length; i++) {
                    this._collectDeps(node[i]);
                }
                break;

            case '=':
            case '!=':
            case '>':
            case '<':
            case '>=':
            case '<=':
                this._collectDeps(node[1]);
                this._collectDeps(node[2]);
                break;
        }
    }
    
    Reflex.prototype.trigger = function() {
        if (!this.active) {
            this.active = true;
            var val = this.expression.evaluate();
            if (val !== this.value) {
                this.value = val;
                this.reaction(this.owner, this.input, this.value);
            }
            this.active = false;
        }
    }
    
    Reflex.prototype.dependsOn = function(name) {
        return this.deps.indexOf(name) != -1;
    }
    
    /**
     * Input
     */
    function createInputClass(init) {
        var cls = function(element) {
            Input.call(this, element);
            init && init.call(this);
        }
        cls.prototype = Object.create(Input.prototype);
        return cls;
    }
    
    var Input = function(element) {
        this.element = $(element);
        this.name = this._extractName(this.element);
        this.callback = null;
        this.exists = true;
        this.marker = null;
    }
    
    Input.prototype._extractName = function(element) {
        return (element.attr('name') || '')
            .split(/[\[\]]+/)
            .filter(function(v) {return v != '';})
            .join('.');
    }
    
    Input.prototype.watch = function(callback) {
        this.unwatch();
        this.callback = callback;
        this.element.on('change', this.callback);
    }
    
    Input.prototype.unwatch = function() {
        if (this.callback) {
            this.element.off('change', this.callback);
            this.callback = null;
        }
    }
    
    Input.prototype.set = function(val) {
        this.element.val(val);
    }
    
    Input.prototype.get = function() {
        return this.isDetached() ? undefined: this.element.val();
    }
    
    Input.prototype.is = function(element) {
        return this.element.is(element);
    }
    
    Input.prototype.hide = function() {
        return this.element.hide();
    }
    
    Input.prototype.show = function() {
        return this.element.show();
    }
    
    Input.prototype.enable = function() {
        return this.element.removeAttr('disabled');
    }
    
    Input.prototype.disable = function() {
        return this.element.attr('disabled', 'disabled');
    }
    
    Input.prototype.remove = function() {
        if (this.exists) {
            this.marker = document.createComment('marker');
            this.element.eq(0).before(this.marker);
            this.element.detach();
            this.exists = false;
        }
    }
    
    Input.prototype.restore = function() {
        if (!this.exists) {
            this.element.insertAfter(this.marker);
            $(this.marker).remove();
            this.marker = null;
            this.exists = true;
        }
    }
    
    Input.prototype.isDetached = function() {
        return !$.contains(document.documentElement, this.element.get(0));
    }
    
    Input.prototype.isDisabled = function() {
        return this.element.is(':disabled');
    }
    
    var RadioInput = createInputClass();
    
    RadioInput.prototype.set = function(val) {
        this.element.each(function() {
            this.checked = $(this).attr('value') == val;
        });
    }
    
    RadioInput.prototype.get = function() {
        return this.isDetached() ? undefined: this.element.filter(':checked').val();
    }
    
    var MultiCheckboxInput = createInputClass();
    
    MultiCheckboxInput.prototype.set = function(val) {
        this.element.each(function() {
            var v = $(this).attr('value');
            this.checked = (typeof val == 'object' && val.constructor == Array) ? val.indexOf(v) != -1 : val == v;
        });
    }
    
    MultiCheckboxInput.prototype.get = function() {
        if (this.isDetached()) {
            return undefined;
        } else {
            var res = [];
            this.element.each(function() {
                if (this.checked) {
                    res.push($(this).attr('value'));
                }
            });
            return res;
        }
    }
    
    var MultiInput = createInputClass();
    
    MultiInput.prototype.set = function(val) {
        if (typeof val == 'object' && val.constructor == Array) {
            this.element.each(function(i) {
                $(this).val(val[i] || '');
            });
        } else {
            this.element.val(val);
        }
    }
    
    MultiInput.prototype.get = function() {
        if (this.isDetached()) {
            return undefined;
        } else {
            var res = [];
            this.element.each(function() {
                res.push($(this).val());
            });
            return res;
        }
    }
    
    var CheckboxInput = createInputClass();
    
    CheckboxInput.prototype.set = function(val) {
        this.element.prop('checked', !!val);
    }
    
    CheckboxInput.prototype.get = function() {
        return this.isDetached() ? undefined : this.element.prop('checked');
    }
    
    var MultiSelectInput = createInputClass();
    
    MultiSelectInput.prototype.set = function(val) {
        this.element.find('option').each(function() {
            var v = $(this).attr('value');
            this.selected = (typeof val == 'object' && val.constructor == Array) ? val.indexOf(v) != -1 : val == v;
        });
    }
    
    MultiSelectInput.prototype.get = function() {
        if (this.isDetached()) {
            return undefined;
        } else {
            var res = [];
            this.element.find('option').each(function() {
                if (this.selected) {
                    res.push($(this).attr('value'));
                }
            });
            return res;
        }
    }
    
    var StaticElement = createInputClass();
    
    StaticElement.prototype.set = function(val) {
        this.element.text(val);
    }
    
    StaticElement.prototype.get = function() {
        return this.isDetached() ? undefined : this.element.text();
    }
    
    StaticElement.prototype.watch = function(callback) {
    }
    
    StaticElement.prototype.unwatch = function() {
    }
    
    /**
     * InputCollection
     */
    var InputCollection = function(owner) {
        this.owner = owner;
        this.inputs = {};
    }
    
    InputCollection.prototype.getElements = function() {
        var result = [];
        for (var name in this.inputs) {
            result.push(this.getElement(name));
        }
        return result;
    }
    
    InputCollection.prototype.getElement = function(name) {
        return this.inputs[name].element;
    }
    
    InputCollection.prototype.getInput = function(name) {
        return this.inputs[name];
    }
    
    InputCollection.prototype.findByElement = function(element) {
        for (var name in this.inputs) {
            var input = this.getInput(name);
            if (input.is(element)) {
                return input;
            }
        }
        return false;
    }
    
    InputCollection.prototype.get = function(name) {
        return (name in this.inputs) ? this.inputs[name].get() : undefined;
    }
    
    InputCollection.prototype.set = function(name, value) {
        if (name in this.inputs) {
            this.inputs[name].set(value);
        }
    }
    
    InputCollection.prototype.reset = function(data) {
        for (var key in data) {
            this.set(key, data[key]);
        }
    }
    
    InputCollection.prototype.getAll = function() {
        var result = {};
        for (var name in this.inputs) {
            if (this.inputs[name].isDetached() == false && this.inputs[name].isDisabled() == false) {
                result[name] = this.inputs[name].get();
            }
        }
        return result;
    }
    
    InputCollection.prototype.add = function(input) {
        var owner = this.owner;
        this.inputs[input.name] = input;
        input.watch(function() {
            owner.refresh(input.name);
        });
    }
    
    InputCollection.prototype.remove = function(name) {
        if (name in this.inputs) {
            this.inputs[name].unwatch();
            delete this.inputs[name];
        }
    }
    
    var pluginApi = {
        'get': function(name) {
            return name ? this.get(name) : this.getAll();
        },
        'set': function(name, value) {
            if (typeof name == 'object') {
                this.populate(name);
            } else {
                this.set(name, value);
            }
            return this;
        },
        'refresh': function(name) {
            this.refresh(name);
            return this;
        }
    };
    
    /**
     * Plugin
     */
    $.fn.reflex = function(method, options) {
        var result = this;
        var args = null;
        if (typeof method != 'string') {
            options = method;
            method = undefined;
        } else {
            args = Array.prototype.slice.call(arguments, 1);
        }
        this.each(function() {
            var instance = $(this).data('reflectable');
            if (method == undefined) {
                if (!instance) {
                    $(this).data('reflectable', instance = new Reflectable(this, options));
                }
            } else {
                if (!instance) {
                    $(this).data('reflectable', instance = new Reflectable(this));
                }
                if (method in pluginApi) {
                    var res = pluginApi[method].apply(instance, args);
                    if (res !== instance) {
                        result = res;
                    }
                }
            }
        });
        return result;
    }
    
    $.reflexAPI = {
        'defaultOptions': defaultOptions,
        'defineReflex': function(type, fn) {
            defaultOptions.reflexes[type] = fn;
        },
        'createInputClass': createInputClass,
        'addInputFactory': function(type, fn) {
            defaultOptions.inputFactories.unshift({'type': type, 'fn': fn});
        },
        'removeInputFactory': function(type) {
            for (var i = 0; i < defaultOptions.inputFactories.length; i++) {
                if (defaultOptions.inputFactories[i].type == type) {
                    defaultOptions.inputFactories.splice(i, 1);
                    return;
                }
            }
        },
        'replaceInputFactory': function(type, fn) {
            for (var i = 0; i < defaultOptions.inputFactories.length; i++) {
                if (defaultOptions.inputFactories[i].type == type) {
                    defaultOptions.inputFactories[i].fn = fn;
                    return;
                }
            }
            defaultOptions.inputFactories.unshift({'type': type, 'fn': fn});
        }
    };
})();