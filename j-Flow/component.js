// Designer: Core
COMPONENT('flow', 'width:6000;height:6000;grid:25;paddingX:6;curvedlines:0', function(self, config) {

	// config.infopath {String}, output: { zoom: Number, selected: Object }
	// config.undopath {String}, output: {Object Array}
	// config.redopath {String}, output: {Object Array}

	var cls = 'ui-flow';
	var drag = {};

	self.readonly();
	self.meta = {};
	self.el = {};     // elements
	self.op = {};     // operations
	self.cache = {};  // cache
	self.info = { zoom: 100 };
	self.undo = [];
	self.redo = [];

	self.make = function() {
		self.aclass(cls);
		//  stroke="{gridcolor}" stroke-width="{gridstroke}"
		self.html('<svg width="{width}" height="{height}" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="svg-grid" width="{grid}" height="{grid}" patternunits="userSpaceOnUse"><path d="M {grid} 0 L 0 0 0 {grid}" fill="none" class="ui-flow-grid" shape-rendering="crispEdges" /></pattern></defs><rect width="100%" height="100%" fill="url(#svg-grid)" shape-rendering="crispEdges" /><g class="lines"></g></svg>'.arg(config));
		self.el.svg = self.find('svg');
		self.el.lines = self.el.svg.find('g.lines');
		self.template = Tangular.compile('<div class="component invisible{{ if inputs && inputs.length }} hasinputs{{ fi }}{{ if outputs && outputs.length }} hasoutputs{{ fi }}" data-id="{{ id }}" style="top:{{ y }}px;left:{{ x }}px"><div class="area">{{ if inputs && inputs.length }}<div class="inputs">{{ foreach m in inputs }}<div class="input" data-index="{{ $index }}"><i class="fa fa-circle"></i></div>{{ end }}</div>{{ fi }}<div class="content">{{ html | raw }}</div>{{ if outputs && outputs.length }}<div class="outputs">{{ foreach m in outputs }}<div class="output" data-index="{{ $index }}"><i class="fa fa-circle"></i>{{ m }}</div>{{ end }}</div>{{ fi }}</div></div>');

		drag.touchmove = function(e) {
			var evt = e.touches[0];
			drag.lastX = evt.pageX;
			drag.lastY = evt.pageY;
		};

		drag.touchend = function(e) {
			e.target = document.elementFromPoint(drag.lastX, drag.lastY);

			if (e.target && e.target.tagName !== 'SVG')
				e.target = $(e.target).closest('svg')[0];

			drag.unbind();

			if (e.target) {
				var pos = self.op.position();
				e.pageX = drag.lastX;
				e.pageY = drag.lastY;
				e.offsetX = e.pageX - pos.left;
				e.offsetY = e.pageY - pos.top;
				drag.drop(e);
			}
		};

		drag.bind = function() {
			$(document).on('touchmove', drag.touchmove);
			$(document).on('touchend', drag.touchend);
		};

		drag.unbind = function() {
			$(document).off('touchmove', drag.touchmove);
			$(document).off('touchend', drag.touchend);
		};

		drag.handler = function(e) {

			drag.el = $(e.target);

			if (e.touches)
				drag.bind();

			if (e.originalEvent.dataTransfer)
				e.originalEvent.dataTransfer.setData('text', '1');
		};

		drag.drop = function(e) {
			var meta = {};
			meta.pageX = e.pageX;
			meta.pageY = e.pageY;
			meta.offsetX = e.offsetX;
			meta.offsetY = e.offsetY;
			meta.el = drag.el;
			meta.target = $(e.target);
			config.ondrop && EXEC(config.ondrop, meta, self);
		};

		$(document).on('dragstart', '[draggable]', drag.handler);
		$(document).on('touchstart', '[draggable]', drag.handler);

		self.el.svg.on('dragenter dragover dragexit drop dragleave', function(e) {
			switch (e.type) {
				case 'drop':
					drag.drop(e);
					break;
			}
			e.preventDefault();
		});
	};

	self.destroy = function() {
		$(document).off('dragstart', drag.handler);
	};

	self.getOffset = function() {
		return self.element.offset();
	};

	self.setter = function(value, path, type) {

		if (type === 2)
			return;

		var keys = Object.keys(value);
		var onmake = config.onmake ? GET(config.onmake) : null;
		var ondone = config.ondone ? GET(config.ondone) : null;
		var onremove = config.onremove ? GET(config.onremove) : null;
		var prev = self.cache;
		var ischanged = false;
		var tmp;
		var el;

		self.cache = {};

		for (var i = 0; i < keys.length; i++) {

			var key = keys[i];
			var com = value[key];
			var checksum = self.helpers.checksum(com);

			// com.id = key
			// com.outputs = ['0 output', '1 output', '2 output'];
			// com.inputs = ['0 input', '1 input', '2 input'];
			// com.connections = { 0: { ID: INDEX_OUTPUT } };
			// com.x
			// com.y
			// com.actions = { select: true, move: true, disabled: false, remove: true, connet: true };

			// Delegates
			// com.onmake = function(el, com)
			// com.ondone = function(el, com)
			// com.onmove = function(el, com)
			// com.onremove = function(el, com)
			// com.onconnect = function(meta)
			// com.ondisconnect = function(meta)

			// done && done(el, com);
			// make && make(el, com);

			var tmp = prev[key];
			var rebuild = true;

			com.id = key;

			if (tmp) {
				if (tmp.checksum === checksum)
					rebuild = false;
				delete prev[key];
				el = tmp.el;
			}

			if (rebuild) {
				tmp && tmp.el.remove();
				var html = self.template(com);
				self.append(html);
				el = self.find('.component[data-id="{id}"]'.arg(com));
				com.onmake && com.onmake(el, com);
				onmake && onmake(el, com);
				if (!ischanged && com.connections && Object.keys(com.connections).length)
					ischanged = true;
				if (type === 1)
					self.op.undo({ type: 'component', id: com.id, instance: com });
			}

			if (!com.connections)
				com.connections = {};

			self.cache[key] = { id: key, instance: com, el: el, checksum: checksum, actions: com.actions || {}};
		}

		// Remove unused components
		keys = Object.keys(prev);
		for (var i = 0; i < keys.length; i++) {
			var key = keys[i];
			tmp = prev[key];
			tmp.instance.onremove && tmp.instance.onremove(tmp.el, tmp.instance);
			onremove && onremove(tmp.el, tmp.instance);
			tmp.el.remove();
		}

		keys = Object.keys(self.cache);
		for (var i = 0; i < keys.length; i++) {
			var key = keys[i];
			tmp = self.cache[key];
			tmp.instance.ondone && tmp.instance.ondone(tmp.el, tmp.instance);
			ondone && ondone(tmp.el, tmp.instance);
		}

		ischanged && self.el.lines.empty();

		setTimeout(function() {
			for (var i = 0; i < keys.length; i++) {
				var key = keys[i];
				tmp = self.cache[key];
				tmp.el.rclass('invisible');
				ischanged && tmp.instance.connections && self.reconnect(tmp);
			}
		}, 500);

		self.op.refreshinfo();
	};

	self.reconnect = function(m) {
		var indexes = Object.keys(m.instance.connections);
		for (var i = 0; i < indexes.length; i++) {
			var index = indexes[i];
			var output = m.el.find('.output[data-index="{0}"]'.format(index));
			var inputs = m.instance.connections[index];
			for (var j = 0; j < inputs.length; j++) {
				var com = inputs[j];
				var el = self.find('.component[data-id="{0}"]'.format(com.id));
				input = el.find('.input[data-index="{0}"]'.format(com.index));
				self.el.connect(output, input, true);
			}
		}
	};

	self.selected = function(callback) {

		var output = {};
		var arr;
		var tmp;
		var el;

		output.components = [];
		output.connections = [];

		arr = self.find('.component-selected');
		for (var i = 0; i < arr.length; i++) {
			el = arr[i];
			tmp = self.cache[el.getAttribute('data-id')];
			tmp && output.components.push(tmp);
		}

		arr = self.find('.connection-selected');
		for (var i = 0; i < arr.length; i++) {

			el = arr[i];
			var cls = el.getAttribute('class').split(' ');
			for (var j = 0; j < cls.length; j++) {
				var c = cls[j];
				if (c.substring(0, 5) === 'conn_') {
					var a = c.split('_');
					var tmp = {};
					tmp.output = self.cache[a[1]].instance;
					tmp.input = self.cache[a[2]].instance;
					tmp.fromid = a[1];
					tmp.toid = a[2];
					tmp.fromindex = a[3];
					tmp.toindex = a[4];
					output.connections.push(tmp);
				}
			}
		}

		callback && callback(output);
		return output;
	};
});

// Designer: Helpers
EXTENSION('flow:helpers', function(self, config) {

	self.helpers = {};

	self.helpers.checksum = function(obj) {
		var checksum = (obj.outputs ? obj.outputs.length : 0) + ',' + (obj.inputs ? obj.inputs.length : 0) + ',' + (obj.body || '');
		return HASH(checksum, true);
	};

	self.helpers.connect = function(x1, y1, x4, y4, index) {

		var y = (y4 - y1) / ((index || 0) + 2);
		var x2 = x1;
		var y2 = y1 + y;
		var x3 = x4;
		var y3 = y1 + y;
		var s = ' ';

		if (config.curvedlines)
			return self.helpers.diagonal(x1, y1, x4, y4);

		var builder = [];

		builder.push('M' + (x1 >> 0) + s + (y1 >> 0));

		if (x1 !== x4 && y1 !== y4) {
			builder.push('L' + (x2 >> 0) + s + (y2 >> 0));
			builder.push('L' + (x3 >> 0) + s + (y3 >> 0));
		}

		if (!config.curvedlines)
			builder.push('L' + (x4 >> 0) + s + (y4 >> 0));

		return builder.join(s);
	};

	self.helpers.move1 = function(x1, y1, conn) {
		var pos = conn.attrd('offset').split(',');
		conn.attr('d', self.helpers.connect(x1, y1, +pos[2], +pos[3], +conn.attrd('fromindex')));
		conn.attrd('offset', x1 + ',' + y1 + ',' + pos[2] + ',' + pos[3]);
	};

	self.helpers.checkconnected = function(meta) {
		meta.el.tclass('connected', Object.keys(meta.instance.connections).length > 0);
	};

	self.helpers.checkconnectedoutput = function(id, index) {
		var is = !!self.el.lines.find('.from_' + id + '_' + index).length;
		self.find('.component[data-id="{0}"]'.format(id)).find('.output[data-index="{0}"]'.format(index)).tclass('connected', is);
	};

	self.helpers.checkconnectedinput = function(id, index) {
		var is = !!self.el.lines.find('.to_' + id + '_' + index).length;
		self.find('.component[data-id="{0}"]'.format(id)).find('.input[data-index="{0}"]'.format(index)).tclass('connected', is);
	};

	self.helpers.move2 = function(x4, y4, conn) {
		var pos = conn.attrd('offset').split(',');
		conn.attr('d', self.helpers.connect(+pos[0], +pos[1], x4, y4, +conn.attrd('fromindex')));
		conn.attrd('offset', pos[0] + ',' + pos[1] + ',' + x4 + ',' + y4);
	};

	self.helpers.isconnected = function(output, input) {

		var co = output.closest('.component');
		var ci = input.closest('.component');
		var coid = self.cache[co.attrd('id')];
		var ciid = self.cache[ci.attrd('id')];

		if (coid.actions.disabled || coid.actions.connect === false || ciid.actions.disabled || ciid.actions.connect === false)
			return true;

		var el = $('.conn_' + co.attrd('id') + '_' + ci.attrd('id') + '_' + output.attrd('index') + '_' + input.attrd('index'));
		return el.length > 0;
	};

	self.helpers.position = function(el) {

		var component = el.closest('.component');
		var pos = el.offset();
		var mainoffset = el.closest('.ui-flow').offset();

		var x = (pos.left - mainoffset.left) + 12;
		var y = (pos.top - mainoffset.top) + 10;

		return { x: x >> 0, y: y >> 0, id: component.attrd('id'), index: +el.attrd('index') };
	};

	self.helpers.parseconnection = function(line) {
		var arr = line.attr('class').split(' ');
		for (var i = 0; i < arr.length; i++) {
			if (arr[i].substring(0, 5) === 'conn_') {
				var info = arr[i].split('_');
				var obj = {};
				obj.fromid = info[1];
				obj.toid = info[2];
				obj.fromindex = info[3];
				obj.toindex = info[4];
				return obj;
			}
		}
	};

	self.helpers.diagonal = function(x1, y1, x4, y4) {
		return 'M' + x1 + ',' + y1 + 'C' + x1 +  ',' + (y1 + y4) / 2 + ' ' + x4 + ',' + (y1 + y4) / 2 + ' ' + x4 + ',' + y4;
	};

});

EXTENSION('flow:operations', function(self, config) {

	// Internal method
	var removeconnections = function(next, removed) {

		var connections = next.instance.connections;
		var keys = Object.keys(connections);
		var meta = {};
		var onremove = function(conn) {

			var is = conn.id === removed.id;
			if (is) {
				meta.output = next.instance;
				meta.input = removed.instance;
				meta.fromid = next.id;
				meta.toid = removed.id;
				meta.toindex = conn.index;
				next.instance.ondisconnect && next.instance.ondisconnect.call(next.instance, meta);
				removed.instance.ondisconnect && removed.instance.ondisconnect.call(removed.instance, meta);
				config.ondisconnect && EXEC(config.ondisconnect, meta);
			}

			return is;
		};

		for (var i = 0; i < keys.length; i++) {
			var index = keys[i];
			var conn = connections[index];
			meta.fromindex = index;
			conn = conn.remove(onremove);
			if (conn.length === 0) {
				delete connections[index];
				self.helpers.checkconnectedoutput(next.id, index);
			}
		}

		self.helpers.checkconnected(next);
	};

	self.op.unselect = function(type) {
		var cls = 'connection-selected';
		if (type == null || type === 'connections')
			self.el.lines.find('.' + cls).rclass(cls);

		cls = 'component-selected';

		if (type == null || type === 'component')
			self.find('.' + cls).rclass(cls);

		if (self.info.selected) {
			self.info.selected = null;
			self.op.refreshinfo();
		}

	};

	self.op.modified = function() {
		self.change(true);
		self.update(true, 2);
	};

	self.op.remove = function(id, noundo) {

		var tmp = self.cache[id];
		if (tmp == null || tmp.actions.remove === false)
			return false;

		tmp.instance.onremove && tmp.instance.onremove(tmp.el, tmp.instance);
		config.onremove && EXEC(config.onremove, tmp.el, tmp.instance);

		delete self.cache[id];
		delete self.get()[id];

		self.el.lines.find('.from_' + id).remove();
		self.el.lines.find('.to_' + id).remove();

		// browse all components and find dependencies to this component
		var keys = Object.keys(self.cache);
		for (var i = 0; i < keys.length; i++) {
			var key = keys[i];
			removeconnections(self.cache[key], tmp);
		}

		var connections = tmp.instance.connections;
		keys = Object.keys(connections);

		for (var i = 0; i < keys.length; i++) {
			var index = keys[i];
			var conns = connections[index];
			for (var j = 0; j < conns.length; j++) {
				var conn = conns[j];
				self.helpers.checkconnectedinput(conn.id, conn.index);
			}
		}

		if (!noundo)
			self.op.undo({ type: 'remove', id: id, instance: tmp.instance });

		self.find('.component[data-id="{0}"]'.format(id)).remove();
		self.op.modified();
		return true;
	};

	self.op.select = function(id) {

		var com = self.cache[id];
		if (com == null)
			return false;

		var cls = 'component-selected';
		self.find('.' + cls).rclass(cls);
		self.find('.component[data-id="{0}"]'.format(id)).aclass(cls);
		self.info.selected = com.instance;
		self.op.refreshinfo();
		return true;
	};

	self.op.disconnect = function(fromid, toid, fromindex, toindex, noundo) {

		if (typeof(fromid) === 'object') {
			var meta = fromid;
			toid = meta.toid;
			fromindex = meta.fromindex;
			toindex = meta.toindex;
			fromid = meta.fromid;
		}

		var a = self.cache[fromid];
		var b = self.cache[toid];

		if (!a || !b)
			return false;

		var ac = a.instance;

		toindex += '';
		fromindex += '';

		var conn = ac.connections[fromindex].findItem(function(conn) {
			return conn.id === toid && conn.index === toindex;
		});

		if (!conn || conn.disabled)
			return false;

		ac.connections[fromindex].splice(ac.connections[fromindex].indexOf(conn));

		if (!ac.connections[fromindex].length)
			delete ac.connections[fromindex];

		if (!noundo)
			self.op.undo({ type: 'disconnect', fromid: fromid, toid: toid, fromindex: fromindex, toindex: toindex });

		self.el.lines.find('.conn_{0}_{1}_{2}_{3}'.format(fromid, toid, fromindex, toindex)).remove();
		self.op.modified();
		self.helpers.checkconnected(a);
		self.helpers.checkconnectedoutput(fromid, fromindex);
		self.helpers.checkconnectedinput(toid, toindex);
		return true;
	};

	self.op.reposition = function() {
		self.el.lines.find('.connection').each(function() {

			var path = $(this);
			var meta = self.helpers.parseconnection(path);
			var output = self.find('.component[data-id="{0}"]'.format(meta.fromid)).find('.output[data-index="{0}"]'.format(meta.fromindex));
			var input = self.find('.component[data-id="{0}"]'.format(meta.toid)).find('.input[data-index="{0}"]'.format(meta.toindex));
			var a = self.helpers.position(output);
			var b = self.helpers.position(input);

			// I don't know why :-D
			b.x -= config.paddingX;

			path.attrd('offset', a.x + ',' + a.y + ',' + b.x + ',' + b.y);
			path.attrd('fromindex', a.index);
			path.attrd('toindex', b.index);
			path.attr('d', self.helpers.connect(a.x, a.y, b.x, b.y, a.index));
		});
	};

	self.op.position = function() {
		var obj = {};
		var scroll = self.closest('.ui-scrollbar-area')[0];

		if (scroll) {
			obj.scrollTop = scroll.scrollTop;
			obj.scrollLeft = scroll.scrollLeft;
		}

		var offset = self.el.svg.offset();
		obj.left = offset.left;
		obj.top = offset.top;
		return obj;
	};

	self.op.refreshinfo = function() {
		config.infopath && SEEX(config.infopath, self.info);
	};

	self.op.undo = function(value) {
		if (value) {
			self.undo.push(value);
			if (self.undo.length > 50)
				self.undo.shift();
		}
		config.undopath && SEEX(config.undopath, self.undo);
	};

	self.op.redo = function(value) {
		if (value) {
			self.redo.push(value);
			if (self.redo.length > 50)
				self.redo.shift();
		}
		config.redopath && SEEX(config.redopath, self.redo);
	};

});

EXTENSION('flow:map', function(self) {

	var events = {};
	var drag = {};

	events.move = function(e) {
		var x = (drag.x - e.pageX);
		var y = (drag.y - e.pageY);

		if (drag.target[0]) {
			drag.target[0].scrollTop +=  ((y / 6) / drag.zoom) >> 0;
			drag.target[0].scrollLeft += ((x / 6) / drag.zoom) >> 0;
		}
	};

	events.movetouch = function(e) {
		events.move(e.touches[0]);
	};

	events.up = function() {
		events.unbind();
	};

	events.bind = function() {
		self.element.on('mouseup', events.up);
		self.element.on('mousemove', events.move);
		self.element.on('touchend', events.up);
		self.element.on('touchmove', events.movetouch);
	};

	events.unbind = function() {
		self.element.off('mouseup', events.up);
		self.element.off('mousemove', events.move);
		self.element.off('touchend', events.up);
		self.element.off('touchmove', events.movetouch);
	};

	self.event('mousedown touchstart', function(e) {

		if (e.target.tagName !== 'rect')
			return;

		var evt = e.touches ? e.touches[0] : e;
		var et = $(e.target);
		var target = et.closest('.ui-scrollbar-area');

		if (!target[0]) {
			target = et.closest('.ui-viewbox')
			if (!target[0])
				return;
		}

		drag.target = target;
		drag.zoom = self.info.zoom / 100;
		drag.x = evt.pageX;
		drag.y = evt.pageY;

		events.bind();
		e.preventDefault();

		// Unselects all selected components/connections
		self.op.unselect();
	});
});

EXTENSION('flow:components', function(self, config) {

	var events = {};
	var drag = {};

	var zoom = function(val) {
		return Math.ceil(val / drag.zoom) - drag.zoomoffset;
	};

	drag.css = {};

	events.move = function(e) {

		var x = (e.pageX - drag.x);
		var y = (e.pageY - drag.y);

		drag.css.left = zoom(drag.posX + x);
		drag.css.top = zoom(drag.posY + y);

		if (!drag.is)
			drag.is = true;

		drag.target.css(drag.css);

		// move all output connections
		for (var i = 0; i < drag.output.length; i++) {
			var conn = $(drag.output[i]);
			var pos = self.helpers.position(conn);
			var arr = self.el.lines.find('.from_' + pos.id + '_' + pos.index);
			for (var j = 0; j < arr.length; j++)
				self.helpers.move1(zoom(pos.x + drag.zoomoffset), zoom(pos.y), $(arr[j]));
		}

		// move all input connections
		for (var i = 0; i < drag.input.length; i++) {
			var conn = $(drag.input[i]);
			var pos = self.helpers.position(conn);
			var arr = self.el.lines.find('.to_' + pos.id + '_' + pos.index);
			for (var j = 0; j < arr.length; j++)
				self.helpers.move2(zoom(pos.x - 6), zoom(pos.y), $(arr[j]));
		}
	};

	events.movetouch = function(e) {
		events.move(e.touches[0]);
	};

	events.up = function() {

		if (drag.is) {
			var data = self.get()[drag.id];
			self.op.undo({ type: 'move', id: drag.id, x: data.x, y: data.y, newx: drag.css.left, newy: drag.css.top });
			data.x = drag.css.left;
			data.y = drag.css.top;
			data.onmove && data.onmove(drag.target, data);
			config.onmove && EXEC(config.onmove, drag.target, data);
			self.op.modified();
			self.el.lines.find('.from_{0},.to_{0}'.format(drag.id)).rclass('highlight');
		}

		events.unbind();
	};

	events.bind = function() {
		self.element.on('mouseup', events.up);
		self.element.on('mousemove', events.move);
		self.element.on('touchend', events.up);
		self.element.on('touchmove', events.movetouch);
	};

	events.unbind = function() {
		self.element.off('mouseup', events.up);
		self.element.off('mousemove', events.move);
		self.element.off('touchend', events.up);
		self.element.off('touchmove', events.movetouch);
	};

	self.event('mousedown touchstart', '.area', function(e) {

		e.preventDefault();

		var evt = e.touches ? e.touches[0] : e;
		var target = $(e.target).closest('.component');
		drag.id = target.attrd('id');

		var tmp = self.cache[drag.id];

		self.op.unselect('connections');

		if (tmp.actions.select !== false)
			self.op.select(drag.id);

		if (tmp.actions.move === false)
			return;

		drag.target = target;
		drag.x = evt.pageX;
		drag.y = evt.pageY;
		drag.zoom = self.info.zoom / 100;
		drag.zoomoffset = ((100 - self.info.zoom) / 10) + (self.info.zoom > 100 ? 1 : -1);

		drag.is = false;
		drag.output = target.find('.output');
		drag.input = target.find('.input');

		var pos = target.position();
		drag.posX = pos.left;
		drag.posY = pos.top;

		self.el.lines.find('.from_{0},.to_{0}'.format(drag.id)).aclass('highlight');
		events.bind();
	});

});

EXTENSION('flow:connections', function(self, config) {

	var events = {};
	var drag = {};
	var prevselected = null;

	drag.css = {};

	var zoom = function(val) {
		return Math.ceil(val / drag.zoom) - drag.zoomoffset;
	};

	events.move = function(e) {
		var x = (e.pageX - drag.x) + drag.offsetX;
		var y = (e.pageY - drag.y) + drag.offsetY;
		drag.path.attr('d', self.helpers.connect(zoom(drag.pos.x),zoom(drag.pos.y), zoom(x), zoom(y), drag.index));
	};

	events.movetouch = function(e) {
		var evt = e.touches[0];
		drag.lastX = evt.pageX;
		drag.lastY = evt.pageY;
		events.move(evt);
	};

	events.up = function(e) {

		drag.path.remove();
		events.unbind();

		if (drag.lastX != null && drag.lastY != null)
			e.target= document.elementFromPoint(drag.lastX, drag.lastY);

		drag.target.add(drag.targetcomponent).rclass('connecting');

		if (drag.input) {

			// DRAGGED FROM INPUT
			var output = $(e.target).closest('.output');
			if (!output.length)
				return;

			// Checks if the connection is existing
			if (self.helpers.isconnected(output, drag.target))
				return;

			self.el.connect(output, drag.target);

		} else {

			// DRAGGED FROM OUTPUT
			var input = $(e.target).closest('.input');
			if (!input.length)
				return;

			// Checks if the connection is existing
			if (self.helpers.isconnected(drag.target, input))
				return;

			self.el.connect(drag.target, input);
		}
	};

	events.bind = function() {
		self.element.on('mouseup', events.up);
		self.element.on('mousemove', events.move);
		self.element.on('touchend', events.up);
		self.element.on('touchmove', events.movetouch);
	};

	events.unbind = function() {
		self.element.off('mouseup', events.up);
		self.element.off('mousemove', events.move);
		self.element.off('touchend', events.up);
		self.element.off('touchmove', events.movetouch);
	};

	self.event('mousedown touchstart', '.output,.input', function(e) {

		e.preventDefault();
		e.stopPropagation();

		var target = $(this);
		var evt = e.touches ? e.touches[0] : e;
		var com = target.closest('.component');
		var tmp = self.cache[com.attrd('id')];

		if (tmp.actions.disabled || tmp.actions.connect === false)
			return;

		var offset = self.getOffset();
		var targetoffset = target.offset();

		drag.input = target.hclass('input');
		drag.target = target;
		drag.index = +target.attrd('index');
		drag.x = evt.pageX;
		drag.y = evt.pageY;
		drag.zoom = self.info.zoom / 100;
		drag.zoomoffset = ((100 - self.info.zoom) / 10) + (self.info.zoom > 100 ? 1 : -1);

		drag.pos = self.helpers.position(target);
		drag.target.add(com).aclass('connecting');
		drag.targetcomponent = com;

		// For touch devices
		drag.lastX = null;
		drag.lastY = null;

		if (drag.input)
			drag.pos.x -= config.paddingX;

		if (evt.offsetX == null || evt.offsetY == null) {
			var off = self.op.position();
			drag.offsetX = drag.x - off.left;
			drag.offsetY = drag.y - off.top;
		} else {
			drag.offsetX = (targetoffset.left - offset.left) + evt.offsetX + (drag.input ? 0 : 5);
			drag.offsetY = (targetoffset.top - offset.top) + evt.offsetY + (drag.input ? 0 : 2);
		}

		drag.path = self.el.lines.asvg('path');
		drag.path.aclass('connection connection-draft');

		events.bind();
	});

	self.el.connect = function(output, input, init) {

		var a = self.helpers.position(output);
		var b = self.helpers.position(input);

		b.x -= config.paddingX;

		drag.zoom = self.info.zoom / 100;
		drag.zoomoffset = ((100 - self.info.zoom) / 10) - 1;

		if (drag.zoom !== 1) {
			b.x = zoom(b.x);
			b.y = zoom(b.y);
			a.x = zoom(a.x);
			a.y = zoom(a.y);
		}

		var path = self.el.lines.asvg('path');
		path.aclass('connection from_' + a.id + ' to_' + b.id + ' from_' + a.id + '_' + a.index + ' to_' + b.id + '_' + b.index + ' conn_' + a.id + '_' + b.id + '_' + a.index + '_' + b.index);
		path.attrd('offset', a.x + ',' + a.y + ',' + b.x + ',' + b.y);
		path.attrd('fromindex', a.index);
		path.attrd('toindex', b.index);
		path.attr('d', self.helpers.connect(a.x, a.y, b.x, b.y, a.index));
		input.add(output).aclass('connected');

		var data = self.get();
		var ac = data[a.id];
		var bc = data[b.id];
		var key = a.index + '';

		if (ac.connections == null)
			ac.connections = {};

		if (ac.connections[key] == null)
			ac.connections[key] = [];

		var arr = ac.connections[key];
		var bindex = b.index + '';
		var is = true;

		for (var i = 0; i < arr.length; i++) {
			var tmp = arr[i];
			if (tmp.id === b.id && tmp.index === bindex) {
				is = false;
				break;
			}
		}

		if (is)
			ac.connections[key].push({ id: b.id + '', index: bindex });

		output.closest('.component').aclass('connected');

		var meta = {};
		meta.output = ac;
		meta.input = data[b.id];
		meta.fromid = a.id;
		meta.toid = b.id;
		meta.fromindex = a.index;
		meta.toindex = b.index;
		meta.path = path;
		ac.onconnect && ac.onconnect.call(ac, meta);
		bc.onconnect && bc.onconnect.call(bc, meta);
		config.onconnect && EXEC(config.onconnect, meta);

		if (!init) {
			self.op.undo({ type: 'connect', fromid: meta.fromid, toid: meta.toid, fromindex: meta.fromindex + '', toindex: meta.toindex + '' });
			self.op.modified();
		}
	};

	self.event('mousedown touchstart', '.connection', function(e) {
		var el = $(this);
		var cls = 'connection-selected';

		self.op.unselect();

		if (el.hclass(cls))
			return;

		prevselected && prevselected.rclass(cls);
		el.aclass(cls);
		prevselected = el;

		var conn = self.helpers.parseconnection(el);

		conn.isconnection = true;
		conn.frominstance = self.cache[conn.fromid].instance;
		conn.toinstance = self.cache[conn.toid].instance;

		self.info.selected = conn;
		self.op.refreshinfo();

		var dom = el[0];
		var parent = el.parent()[0];

		parent.removeChild(dom);
		parent.appendChild(dom);

		e.preventDefault();
		e.stopPropagation();
	});

});

EXTENSION('flow:commands', function(self) {

	var zoom = 1;

	var disconnect = function() {
		var arr = self.el.lines.find('.connection-selected');
		for (var i = 0; i < arr.length; i++) {
			var obj = self.helpers.parseconnection($(arr[i]));
			obj && self.op.disconnect(obj.fromid, obj.toid, obj.fromindex, obj.toindex);
		}
	};

	var remove = function() {
		var arr = self.find('.component-selected');
		for (var i = 0; i < arr.length; i++)
			self.op.remove($(arr[i]).attrd('id'));
	};

	self.command('flow.refresh', self.op.reposition);

	self.command('flow.selected.disconnect', function() {
		disconnect();
		self.op.unselect();
	});

	self.command('flow.selected.remove', function() {
		remove();
		self.op.unselect();
	});

	self.command('flow.selected.clear', function() {
		disconnect();
		remove();
		self.op.unselect();
	});

	self.command('flow.components.add', function(com) {
		com.id = 'F' + Date.now() + '';
		var data = self.get();
		data[com.id] = com;
		self.op.modified();
		self.refresh(true);
	});

	self.command('flow.zoom', function(type) {

		switch (type) {
			case 'in':
				zoom -= 0.05;
				break;
			case 'out':
				zoom += 0.05;
				break;
			case 'reset':
				zoom = 1;
				break;
		}

		if (zoom < 0.3 || zoom > 1.7)
			return;

		self.info.zoom = 100 * zoom;
		self.op.refreshinfo();
		self.element.css('transform', 'scale({0})'.format(zoom));
	});

	self.command('flow.undo', function() {

		var prev = self.undo.pop();
		if (prev == null)
			return;

		self.op.undo();
		self.op.redo(prev);

		if (prev.type === 'disconnect') {
			var output = self.find('.component[data-id="{0}"]'.format(prev.fromid)).find('.output[data-index="{0}"]'.format(prev.fromindex));
			var input = self.find('.component[data-id="{0}"]'.format(prev.toid)).find('.input[data-index="{0}"]'.format(prev.toindex));
			self.el.connect(output, input, true);
			return;
		}

		if (prev.type === 'connect') {
			self.op.disconnect(prev.fromid, prev.toid, prev.fromindex, prev.toindex, true);
			return;
		}

		if (prev.type === 'component') {
			self.op.remove(prev.id, true);
			return;
		}

		if (prev.type === 'move') {
			self.find('.component[data-id="{0}"]'.format(prev.id)).css({ left: prev.x, top: prev.y });
			self.op.reposition();
			return;
		}

		if (prev.type === 'remove') {
			var com = prev.instance;
			com.id = prev.id;
			var data = self.get();
			data[com.id] = com;
			self.op.modified();
			self.update('refresh');
			return;
		}

	});

	self.command('flow.redo', function() {

		var next = self.redo.pop();
		if (next == null)
			return;

		self.op.redo();
		self.op.undo(next);
		self.op.refreshinfo();

		if (next.type === 'disconnect') {
			self.op.disconnect(next.fromid, next.toid, next.fromindex, next.toindex, true);
			return;
		}

		if (next.type === 'connect') {
			var output = self.find('.component[data-id="{0}"]'.format(next.fromid)).find('.output[data-index="{0}"]'.format(next.fromindex));
			var input = self.find('.component[data-id="{0}"]'.format(next.toid)).find('.input[data-index="{0}"]'.format(next.toindex));
			self.el.connect(output, input, true);
			return;
		}

		if (next.type === 'component') {
			var com = next.instance;
			com.id = next.id;
			var data = self.get();
			data[com.id] = com;
			self.op.modified();
			self.refresh(true);
			return;
		}

		if (next.type === 'move') {
			self.find('.component[data-id="{0}"]'.format(next.id)).css({ left: next.newx, top: next.newy });
			self.op.reposition();
			return;
		}

		if (next.type === 'remove') {
			self.op.remove(next.id, true);
			return;
		}

	});

	// Resets editor
	self.command('flow.reset', function() {
		self.undo = [];
		self.redo = [];
		self.cache = {};
		self.refresh();
		self.info.selected = null;
		self.op.refreshinfo();
	});

});