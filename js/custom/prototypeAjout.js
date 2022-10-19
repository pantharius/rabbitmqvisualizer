
/* Functions needed */
Array.prototype.indexOfAttr = function(attr, value){
    for(var i = 0; i < this.length; i += 1) {
        if(this[i][attr] === value) {
            return i;
        }
    }
    return -1;
}

Array.prototype.groupBy = function(fn) {
    const map = new Map();
    this.forEach((item) => {
         const key = fn(item);
         const collection = map.get(key);
         if (!collection) {
             map.set(key, [item]);
         } else {
             collection.push(item);
         }
    });
    return map;
}


Number.prototype.format = function(n, x) {
    var re = '\\d(?=(\\d{' + (x || 3) + '})+' + (n > 0 ? '\\.' : '$') + ')';
    return this.toFixed(Math.max(0, ~~n)).replace(new RegExp(re, 'g'), '$& ').replace('.', ',');
    // ~~ : is a double NOT bitwise operator. It means remove after-comma part
};
String.prototype.formatTime = function() {
    var re = '^([0-9]|0[0-9]|1[0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9])$';
    return this.replace(new RegExp(re, 'g'), '$1:$2');
};
String.prototype.formatWeekDay = function() {
    var jours = ["Dimanche","Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi"];
    return jours[parseInt(this)];
};
Date.prototype.formatDate = function() {
    let d = this;
    return (d.getDate() < 10 ? '0' : '') + d.getDate() + "/" + ((d.getMonth() + 1) < 10 ? '0' : '') + (d.getMonth() + 1) + "/" + d.getFullYear() + " Ã  " + (d.getHours() < 10 ? '0' : '') + d.getHours() + ":" + ((d.getMinutes() < 10 ? '0' : '') + d.getMinutes())
};

String.prototype.copyToClipboard = function() {
    var sampleTextarea = document.createElement("textarea");
    document.body.appendChild(sampleTextarea);
    sampleTextarea.value = this; //save main text in it
    sampleTextarea.select(); //select textarea contenrs
    document.execCommand("copy");
    document.body.removeChild(sampleTextarea);
    Swal.fire({title:'Copier Ã  votre presse-papier',icon:'success'});
}

String.prototype.isValidUrl = function() {
    let url;
    try { url = new URL(this); }
    catch (_) {  return false; }
    return url.protocol === "http:" || url.protocol === "https:";
}