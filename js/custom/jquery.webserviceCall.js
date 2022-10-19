var WS = {
    url: "",
    call: function (method, path, parameters = [], callback = false, callbackAlways = false, callbackError = false, auth = null, url = this.url) {
        var response = null;
        $.ajax({
            url: url + path,
            type: method,
            data: {
                parameters: parameters
            },
            cache: false,
            beforeSend: function (xhr) {
                if (auth != null)
                    xhr.setRequestHeader("Authorization", 'Basic ' + btoa(auth));
            },
            success: function (obj) {
                try {
                    response = obj;
                    callback && callback(response);
                } catch (e) {
                    console.error("Une erreur est survenue", e, obj);
                }
            },
            async: (typeof callback == "function"),
            complete: function (xhr, textStatus) {
                callbackAlways && callbackAlways(xhr, textStatus);
            },
            error: function (xhr, desc, err) {
                callbackError && callbackError(xhr, desc, err);
                if (xhr.status != 403) console.error(xhr, err);
            }
        });
        return response;
    },
    removefunctions(obj) {
        var ret = obj;
        for (var property in ret) {
            if (ret.hasOwnProperty(property)) {
                if (typeof ret[property] == "object") {
                    this.removefunctions(ret[property]);
                } else if (typeof ret[property] == "function") {
                    delete ret[property];
                }
            }
        }
        return ret;
    },
    handleSpecificErrors(obj, callbalckErrors) {
        if (!obj) return;
        if (obj.Error) {
            callbalckErrors && callbalckErrors(obj.Error);
            return true;
        }
        if (obj.Exception) {
            callbalckErrors && callbalckErrors(obj.Exception);
            return true;
        }
        if (Array.isArray(obj) && obj[0].Error) {
            obj.forEach((el) => {
                callbalckErrors && callbalckErrors(el.Error);
            });
            return true;
        }
        return false;
    }
};