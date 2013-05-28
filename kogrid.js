(function () {
    ///
    /// KOGridColumn
    ///
    function KOGridColumn(config) {
        this.key = config.key;
        this.title = config.title;
        this.map = config.map;

        this.template = function (row) {
            return (row._class || 'data') + '-' + this.key;
        };

        //this.value = (config && config.value) || ko.computed(function (row, val) {
        //    if (arguments.length > 1) {
        //        if (typeof row[this.key] === 'function') {
        //            row[this.key](val);
        //        } else {
        //            row[this.key] = val;
        //        }
        //    }

        //    return typeof row[this.key] === 'function' ? row[this.key]() : row[this.key];
        //});
    };

    ///
    /// KOGrid
    ///
    function KOGrid(config) {
        this.transforms = [];

        // TODO rename to 'cols'
        this.columns = [];

        // TODO rename to 'rows'
        this.data = ko.observableArray([]);

        this.view = [];
        this.inputs = [];

        this.rowFactory = (config && config.rowFactory) || function (data) {
            return data;
        };
    };

    KOGrid.prototype.addColumn = function (config) {
        this.columns.push(new KOGridColumn(config));
    };

    KOGrid.prototype.addTransform = function (transform) {
        this.transforms.push(transform);
    };

    KOGrid.prototype.addRow = function (_row) {
        var row = this.rowFactory(_row);
        this.data.push(row);
    };

    KOGrid.prototype.addInput = function (input) {
        this.inputs.push(input);
    };

    KOGrid.prototype.setData = function (data) {
        var self = this;

        data.forEach(function (v) {
            self.data.push(self.rowFactory(v));
        });

        this.data(data);
    };

    KOGrid.prototype.flatten = function (data) {
        var stack = [];

        data.forEach(function (v) {
            stack.push(v);
        });

        var result = [];

        while (stack.length > 0) {
            var item = stack.shift();
            result.push(item);
            if (item._group) {
                for (var i = item._group.length - 1; i >= 0; i--) {
                    stack.unshift(item._group[i]);
                }
            }
        }

        return result;
    };

    // TODO rename to 'view'
    KOGrid.prototype.rows = function () {
        var self = this;

        var result = this.data();

        this.transforms.forEach(function (transform) {
            if (transform.enabled()) { result = transform.execute(result); }
        });

        // flatten data

        this.view = result = this.flatten(result);

        return result;
    };

    (window.kog = window.kog || {}).KOGrid = KOGrid;

    ///
    /// KOValueFilter
    ///
    function KOValueFilter(template) {
        this.template = template || "ko-value-filter";
        this.value = ko.observable();
    }

    KOValueFilter.prototype.filter = function (row, key) {
        var value = typeof row[key] === 'function' ? row[key]() : row[key];
        return !this.value() || this.value().length < 1 || this.value() === value;
    };

    (kog.filters = kog.filters || {}).KOValueFilter = KOValueFilter;

    ///
    /// KORangeFilter
    ///
    function KORangeFilter(template) {
        this.template = template || "ko-range-filter";
        this.min = ko.observable();
        this.max = ko.observable();
    }

    KORangeFilter.prototype.filter = function (row, key) {
        var value = typeof row[key] === 'function' ? row[key]() : row[key];
        return (!this.min() || this.min().length < 1 || value >= this.min()) && (!this.max() || this.max().length < 1 || value <= this.max());
    };

    (kog.filters = kog.filters || {}).KORangeFilter = KORangeFilter;

    ///
    /// KOFilterTransform
    ///
    function KOFilterTransform(config) {
        var title = (config && config.title) || "Filter";
        var enabled = ko.observable(true);
        var visible = ko.observable((config && config.visible) ? true : false);
        var filters = {};

        function template(col) {
            return filters[col.key] ? filters[col.key].template : "ko-empty-filter";
        };

        function data(col) {
            return filters[col.key] || null;
        };

        this.title = title;
        this.enabled = enabled;
        this.visible = visible;
        this.filters = filters;

        this.template = template;
        this.data = data;
    }

    KOFilterTransform.prototype.addFilter = function (key, filter) {
        this.filters[key] = filter;
    };

    KOFilterTransform.prototype.execute = function (rows) {
        var self = this;
        var result = [];

        rows.forEach(function (row) {
            var ok = true;

            for (var key in self.filters) {
                ok = ok && self.filters[key].filter(row, key);
            }

            if (ok) {
                result.push(row);
            }
        });

        return result;
    };

    (kog.transforms = kog.transforms || {}).KOFilterTransform = KOFilterTransform;

    ///
    /// KOValueGrouper
    ///
    function KOValueGrouper(config) {
        this.template = (config && config.template) || "ko-value-grouper";
        this.enabled = ko.observable((config && config.enabled) ? true : false);
    }

    KOValueGrouper.prototype.group = function (row, key) {
        return typeof row[key] === 'function' ? row[key]() : row[key];
    };

    (kog.groupers = kog.groupers || {}).KOValueGrouper = KOValueGrouper;

    ///
    /// KOGroupTransform
    ///
    function KOGroupTransform(config) {
        var _class = (config && config._class) || 'group';

        var title = (config && config.title) || "Group";
        var enabled = ko.observable(true);
        var visible = ko.observable((config && config.visible) ? true : false);
        var groupers = {};

        function template(col) {
            return groupers[col.key] ? groupers[col.key].template : "ko-empty-grouper";
        };

        function data(col) {
            return groupers[col.key] ? groupers[col.key] : null;
        };

        this._class = _class;
        this.title = title;
        this.enabled = enabled;
        this.visible = visible;
        this.groupers = groupers;

        this.template = template;
        this.data = data;
    }

    KOGroupTransform.prototype.addGrouper = function (columnId, grouper) {
        this.groupers[columnId] = grouper;
    };

    KOGroupTransform.prototype.execute = function (rows) {
        var self = this;

        var groupingEnabled = false;

        for (var key in self.groupers) {
            if (self.groupers[key].enabled()) {
                groupingEnabled = true;
                break;
            }
        }

        if (!groupingEnabled) {
            return rows;
        }

        var groups = {};
        var group = {};
        var groupKey;

        // create groups
        rows.forEach(function (row) {
            for (var columnId in self.groupers) {
                if (self.groupers[columnId].enabled()) {
                    group[columnId] = self.groupers[columnId].group(row, columnId);
                }
            }

            groupKey = JSON.stringify(group);

            if (!groups[groupKey]) {
                group._class = self._class;
                group._group = [];
                groups[groupKey] = group;
                group = {};
            }

            groups[groupKey]._group.push(row);
        });

        var result = [];

        for (groupKey in groups) {
            result.push(groups[groupKey]);
        }

        return result;
    };

    (kog.transforms = kog.transforms || {}).KOGroupTransform = KOGroupTransform;

    ///
    /// KOSumAggregator
    ///
    function KOSumAggregator(config) {
        this.template = (config && config.template) || "ko-sum-aggregator";
        this.enabled = ko.observable((config && config.enabled) ? true : false);
    }

    KOSumAggregator.prototype.aggregate = function (row, key) {
        var self = this;

        if (this.enabled() && row._group) {
            row[key] = ko.computed({
                read: function () {
                    var sum = 0;

                    row._group.forEach(function (v) {
                        var fl = parseFloat(typeof v[key] === 'function' ? v[key]() : v[key]);
                        sum += fl;
                    });

                    return sum;
                },
                write: function (value) {
                    var sum = 0;

                    row._group.forEach(function (v) {
                        var fl = parseFloat(typeof v[key] === 'function' ? v[key]() : v[key]);
                        sum += fl;
                    });

                    value = parseFloat(value);

                    // TODO: if sum === 0, this will not work
                    row._group.forEach(function (v) {
                        if (typeof v[key] === 'function') {
                            v[key](v[key]() * value / sum);
                        } else {
                            v[key] = v[key] * value / sum;
                        }
                    });
                },
                owner: self
            }
            );
        }
    };

    (kog.aggregators = kog.aggregators || {}).KOSumAggregator = KOSumAggregator;

    ///
    /// KOAggregateTransform
    ///
    function KOAggregateTransform(config) {
        var title = (config && config.title) || "Aggregate";
        var enabled = ko.observable(true);
        var visible = ko.observable((config && config.visible) ? true : false);
        var aggregators = {};

        function template(col) {
            return aggregators[col.key] ? aggregators[col.key].template : "ko-empty-aggregator";
        };

        function data(col) {
            return aggregators[col.key] || null;
        };

        this.title = title;
        this.enabled = enabled;
        this.visible = visible;
        this.aggregators = aggregators;

        this.template = template;
        this.data = data;
    }

    KOAggregateTransform.prototype.addAggregator = function (key, aggregator) {
        this.aggregators[key] = aggregator;
    };

    KOAggregateTransform.prototype.execute = function (rows) {
        var self = this;

        rows.forEach(function (row) {
            for (var key in self.aggregators) {
                self.aggregators[key].aggregate(row, key);
            }
        });

        return rows;
    };

    (kog.transforms = kog.transforms || {}).KOAggregateTransform = KOAggregateTransform;

    ///
    /// KOValueComparator
    ///
    function KOValueComparator(template) {
        this.template = template || "ko-value-comparator";
        this.desc = ko.observable(false);
    }

    KOValueComparator.prototype.compare = function (rowA, rowB, key) {

        var valA = typeof rowA[key] === 'function' ? rowA[key]() : rowA[key];
        var valB = typeof rowB[key] === 'function' ? rowB[key]() : rowB[key];

        return (valA > valB ? 1 : valA < valB ? -1 : 0) * (self.desc() ? -1 : 1);
    };

    (kog.comparators = kog.comparators || {}).KOValueComparator = KOValueComparator;

    ///
    /// KOSortTransform
    ///
    function KOSortTransform(config) {
        var title = (config && config.title) || "Sort";
        var enabled = ko.observable(false);
        var visible = ko.observable((config && config.visible) ? true : false);
        var comparators = {};
        var columnId = ko.observable();

        function template(col) {
            return comparators[col.key] ? comparators[col.key].template : "ko-empty-comparator";
        };

        function data(col) {
            return comparators[col.key] || null;
        };

        this.title = title;
        this.enabled = enabled;
        this.visible = visible;
        this.comparators = comparators;
        this.columnId = columnId;

        this.template = template;
        this.data = data;
    }

    KOSortTransform.prototype.addComparator = function (key, comparator) {
        this.comparators[key] = comparator;
    };

    KOSortTransform.prototype.execute = function (rows) {
        var self = this;

        if (self.columnId()) {
            rows.sort(function (rowA, rowB) {
                return self.comparators[self.columnId()].compare(rowA, rowB, key);
            });
        }

        return rows;
    };

    (kog.transforms = kog.transforms || {}).KOSortTransform = KOSortTransform;

    ///
    /// KOTextInput
    ///
    function KOTextInput(config) {
        this.template = (config && config.template) || "ko-text-input";
        this.value = ko.observable();
        this.defaultValue = (config && config.defaultValue) || "";
    }

    KOTextInput.prototype.get = function () {
        return this.value() || this.defaultValue;
    };

    (kog.inputs = kog.inputs || {}).KOTextInput = KOTextInput;

    ///
    /// KOIntInput
    ///
    function KOIntInput(config) {
        this.template = (config && config.template) || "ko-int-input";
        this.value = ko.observable();
        this.defaultValue = (config && config.defaultValue) || 0;
    }

    KOIntInput.prototype.get = function () {
        return parseInt(this.value() || this.defaultValue);
    };

    (kog.inputs = kog.inputs || {}).KOIntInput = KOIntInput;

    ///
    /// KOFloatInput
    ///
    function KOFloatInput(config) {
        this.template = (config && config.template) || "ko-float-input";
        this.value = ko.observable();
        this.defaultValue = (config && config.defaultValue) || 0;
    }

    KOFloatInput.prototype.get = function () {
        return parseFloat(this.value() || this.defaultValue);
    };

    (kog.inputs = kog.inputs || {}).KOFloatInput = KOFloatInput;

    ///
    /// KOInputRow
    ///
    function KOInputRow(grid) {
        var self = this;
        var grid = grid;
        var enabled = ko.observable(true);
        var inputs = {};

        function template(col) {
            return inputs[col.key] ? inputs[col.key].template : "ko-empty-input";
        };

        function data(col) {
            return inputs[col.key] || null;
        };

        this.grid = grid;
        this.enabled = enabled;
        this.inputs = inputs;

        this.template = template;
        this.data = data;

        this.insert = function () {
            var result = {};

            for (var key in inputs) {
                result[key] = inputs[key].get();
                inputs[key].value("");
            };

            grid.addRow(result);
        };
    };

    KOInputRow.prototype.addInput = function (key, input) {
        this.inputs[key] = input;
    };

    (kog.inputs = kog.inputs || {}).KOInputRow = KOInputRow;

}());