r.login = {
    post: function(form, action, callback) {
        var username = $('input[name="user"]', form.$el).val(),
            endpoint = r.config.https_endpoint || ('http://'+r.config.cur_domain)
            sameOrigin = location.protocol+'//'+location.host == endpoint,
            apiTarget = endpoint+'/api/'+action+'/'+username

        if (sameOrigin || $.support.cors) {
            var params = form.serialize()
            params.push({name:'api_type', value:'json'})
            $.ajax({
                url: apiTarget,
                type: 'POST',
                dataType: 'json',
                data: params,
                success: callback,
                error: function(xhr, err) {
                    callback(false, err, xhr)
                },
                xhrFields: {
                    withCredentials: true
                }
            })
        } else {
            var iframe = $('<iframe>'),
                postForm = form.$el.clone(true),
                frameName = ('resp'+Math.random()).replace('.', '')

            iframe
                .css('display', 'none')
                .attr('name', frameName)
                .appendTo('body')

            iframe[0].contentWindow.name = frameName

            postForm
                .unbind()
                .css('display', 'none')
                .attr('action', apiTarget)
                .attr('target', frameName)
                .appendTo('body')
            
            $('<input>')
                .attr({
                    type: 'hidden',
                    name: 'api_type',
                    value: 'json'
                })
                .appendTo(postForm)

            $('<input>')
                .attr({
                    type: 'hidden',
                    name: 'hoist',
                    value: r.login.hoist.type
                })
                .appendTo(postForm)

            r.login.hoist.watch(action, function(result) {
                if (!r.config.debug) {
                    iframe.remove()
                    postForm.remove()
                }
                callback(result)
            })

            postForm.submit()
        }
    }
}

r.login.hoist = {
    type: 'cookie',
    watch: function(name, callback) {
        var cookieName = 'hoist_'+name

        var interval = setInterval(function() {
            data = $.cookie(cookieName)
            if (data) {
                try {
                    data = JSON.parse(data)
                } catch(e) {
                    data = null
                }
                $.cookie(cookieName, null, {domain:r.config.cur_domain})
                clearInterval(interval)
                callback(data)
            }
        }, 100)
    }
}

r.login.ui = {
    init: function() {
        if (!r.config.logged) {
            $('.content form.login-form, .side form.login-form').each(function(i, el) {
                new r.ui.LoginForm(el)
            })

            $('.content form.register-form').each(function(i, el) {
                new r.ui.RegisterForm(el)
            })

            this.popup = new r.ui.LoginPopup($('.login-popup')[0])

            $(document).delegate('.login-required', 'click', $.proxy(this, 'loginRequiredAction'))
        }
    },

    loginRequiredAction: function(e) {
        if (r.config.logged) {
            return true
        } else {
            var el = $(e.target),
                href = el.attr('href'),
                dest
            if (href && href != '#') {
                // User clicked on a link that requires login to continue
                dest = href
            } else {
                // User clicked on a thing button that requires login
                var thing = el.thing()
                if (thing.length) {
                    dest = thing.find('.comments').attr('href')
                }
            }

            this.popup.show(true, dest && function() {
                window.location = dest
            })

            return false
        }
    }
}

r.ui.LoginForm = function() {
    r.ui.Form.apply(this, arguments)
}
r.ui.LoginForm.prototype = $.extend(new r.ui.Form(), {
    showErrors: function(errors) {
        r.ui.Form.prototype.showErrors.call(this, errors)
        if (errors.length) {
            this.$el.find('.recover-password')
                .addClass('attention')
        }
    },

    showStatus: function() {
        this.$el.find('.error').css('opacity', 1)
        r.ui.Form.prototype.showStatus.apply(this, arguments)
    },
    
    resetErrors: function() {
        if (this.$el.hasClass('login-form-side')) {
            // Dim the error in place so the form doesn't change size.
            var errorEl = this.$el.find('.error')
            if (errorEl.is(':visible')) {
                errorEl.fadeTo(100, .35)
            }
        } else {
            r.ui.Form.prototype.resetErrors.apply(this, arguments)
        }
    },

    _submit: function() {
        r.login.post(this, 'login', $.proxy(this, 'handleResult'))
    },

    _handleResult: function(result) {
        if (!result.json.errors.length) {
            // Success. Load the destination page with the new session cookie.
            if (this.successCallback) {
                this.successCallback(result)
            } else {
                var defaultDest = window.location.pathname.match(/^\/login/) ? '/' : window.location,
                    destParam = $.url().param('dest')
                destParam = destParam && decodeURIComponent(destParam)
                window.location = destParam || defaultDest
            }
        } else {
            r.ui.Form.prototype._handleResult.call(this, result)
        }
    }
})


r.ui.RegisterForm = function() {
    r.ui.Form.apply(this, arguments)
}
r.ui.RegisterForm.prototype = $.extend(new r.ui.Form(), {
    _submit: function() {
        r.login.post(this, 'register', $.proxy(this, 'handleResult'))
    },

    _handleResult: r.ui.LoginForm.prototype._handleResult
})

r.ui.LoginPopup = function(el) {
    r.ui.Base.call(this, el)
    this.loginForm = new r.ui.LoginForm(this.$el.find('form.login-form:first'))
    this.registerForm = new r.ui.RegisterForm(this.$el.find('form.register-form:first'))
}
r.ui.LoginPopup.prototype = $.extend(new r.ui.Base(), {
    show: function(notice, callback) {
        this.loginForm.successCallback = callback
        this.registerForm.successCallback = callback
        $.request("new_captcha", {id: this.$el.attr('id')})
        this.$el
            .find(".cover-msg").toggle(!!notice).end()
            .show()
    }
})
