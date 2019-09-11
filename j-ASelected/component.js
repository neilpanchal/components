COMPONENT('aselected', 'selector:a;attr:href;class:selected', function(self, config) {

	self.readonly();
	self.blind();

	self.make = function() {
		self.refresh();
		ON('location', self.refresh);
	};

	self.refresh = function() {
		var arr = self.find(config.selector);
		var url = location.pathname;
		for (var i = 0; i < arr.length; i++) {
			var el = $(arr[i]);
			var href = el.attr(config.attr);
			var selected = config.strict ? url === href : url.length === 1 || href.length === 1 ? href === url : url.indexOf(href) === 0;
			el.tclass(config.class, selected);
		}
	};
});