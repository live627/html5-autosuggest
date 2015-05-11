function AutoSuggest(oOptions)
{
	this.opt = oOptions;

	this.oTextHandle = document.getElementById(this.opt.sControlId);
	this.oRealTextHandle = null;
	this.oSuggestDivHandle = null;
	this.aSuggestIdCache = [];
	this.aCache = [];
	this.sRetrieveURL = 'sRetrieveURL' in this.opt ? this.opt.sRetrieveURL : '%scripturl%action=suggest;suggest_type=%suggest_type%;search=%search%;%sessionVar%=%sessionID%;xml;time=%time%';
	this.iMaxDisplayQuantity = 'iMaxDisplayQuantity' in this.opt ? this.opt.iMaxDisplayQuantity : 15;
	this.iMinimumSearchChars = 'iMinimumSearchChars' in this.opt ? this.opt.iMinimumSearchChars : 3;
	this.bItemList = 'bItemList' in this.opt ? this.opt.bItemList : false;
	this.aListItems = 'aListItems' in this.opt ? this.opt.aListItems : [];
	this.sItemTemplate = 'sItemTemplate' in this.opt ? this.opt.sItemTemplate : '<input type="hidden" name="%post_name%[]" value="%item_id%"><a href="%item_href%" class="col-xs-9 list-group-item" onclick="window.open(this.href, \'_blank\'); return false;">%item_name%</a><a href="#" class="generic_icons delete col-xs-2 list-group-item" title="%delete_text%" onclick="return %self%.deleteAddedItem(%item_id%);"></a>';
	this.sTextDeleteItem = 'sTextDeleteItem' in this.opt ? this.opt.sTextDeleteItem : '';
	this.oCallback = {};

	addLoadEvent(this.opt.sSelf + '.init();');
}

AutoSuggest.prototype.init = function()
{
	// Create a backup text input.
	this.oRealTextHandle = document.createElement('input');
	this.oRealTextHandle.type = 'hidden';
	this.oRealTextHandle.name = this.oTextHandle.name;
	this.oRealTextHandle.value = this.oTextHandle.value;
	this.oTextHandle.form.appendChild(this.oRealTextHandle);

	// Disable autocomplete in any browser by obfuscating the name.
	this.oTextHandle.name = 'dummy_' + Math.floor(Math.random() * 1000000);

	if (this.bItemList)
	{
		if ('sItemListContainerId' in this.opt)
			this.oItemList = document.getElementById(this.opt.sItemListContainerId);
		else
		{
			this.oItemList = document.createElement('div');
			this.oTextHandle.parentNode.insertBefore(this.oItemList, this.oTextHandle.nextSibling);
		}
		this.oItemList.className = 'list-group';
	}

	if (this.aListItems.length > 0)
		for (var i = 0, n = this.aListItems.length; i < n; i++)
			this.addItemLink(this.aListItems[i].sItemId, this.aListItems[i].sItemName);

	var self = this;
	var dataList = $("<datalist>").insertAfter("#" + this.opt.sControlId);

	$("#" + this.opt.sControlId).on("input", function(e) {
		var
			that = $(this),
			val = that.val();

		if (self.aCache[val])
		{
			if ('onBeforeUpdate' in self.oCallback && typeof(self.oCallback.onBeforeUpdate) == 'string')
			{
				if (!eval(self.oCallback.onBeforeUpdate + '(' + self.opt.sSelf + ');'))
					return false;
			}
			dataList.empty();
			$(self.aCache[val]).each(function (k, v) {
				$("<option></option>").attr("value", k).html(v).appendTo(dataList);
			});
			that.val('');
			return;
		}

		var sSearchString = self.oTextHandle.value.replace(/^("[^"]+",[ ]*)+/, '').replace(/^([^,]+,[ ]*)+/, '');
		sSearchString = sSearchString.php_to8bit().php_urlencode();
		var url = self.sRetrieveURL.replace(/%scripturl%/g, smf_prepareScriptUrl(smf_scripturl)).replace(/%suggest_type%/g, self.opt.sSearchType).replace(/%search%/g, sSearchString).replace(/%sessionVar%/g, self.opt.sSessionVar).replace(/%sessionID%/g, self.opt.sSessionId).replace(/%time%/g, new Date().getTime());

		if(val === "")
			return;

		if (self.aSuggestIdCache[val])
		{
			self.addItemLink(val, self.aSuggestIdCache[val]);
			that.val('');
			self.aSuggestIdCache = [];
			return;
		}

		that.attr('list', that.attr('id') + '-list');
		dataList.attr('id', that.attr('id') + '-list');

		if ('onBeforeUpdate' in self.oCallback && typeof(self.oCallback.onBeforeUpdate) == 'string')
		{
			if (!eval(self.oCallback.onBeforeUpdate + '(' + self.opt.sSelf + ');'))
				return false;
		}

		$.get(url, function(XMLDoc) {
			dataList.empty();
			$('item', XMLDoc).each(function (i) {
				self.aSuggestIdCache[$(this).attr('id')] = $(this).text();
				$("<option></option>").attr("value", $(this).attr('id')).html($(this).text()).appendTo(dataList);
				self.aCache[val] = self.aSuggestIdCache;
			});
		},"xml");
	});

	return true;
}

AutoSuggest.prototype.registerCallback = function(sCallbackType, sCallback)
{
	switch (sCallbackType)
	{
		case 'onBeforeAddItem':
			this.oCallback.onBeforeAddItem = sCallback;
			break;

		case 'onAfterAddItem':
			this.oCallback.onAfterAddItem = sCallback;
			break;

		case 'onAfterDeleteItem':
			this.oCallback.onAfterDeleteItem = sCallback;
			break;

		case 'onBeforeUpdate':
			this.oCallback.onBeforeUpdate = sCallback;
			break;
	}
}

AutoSuggest.prototype.addItemLink = function (sItemId, sItemName, bFromSubmit)
{
	if (document.getElementById('suggest_' + this.opt.sSuggestId + '_' + sItemId))
		return;

	if ('oCallback' in this && 'onBeforeAddItem' in this.oCallback && typeof(this.oCallback.onBeforeAddItem) == 'string')
	{
		if (!eval(this.oCallback.onBeforeAddItem + '(' + this.opt.sSelf + ', \'' + sItemId + '\');'))
			return;
	}

	var oNewDiv = document.createElement('div');
	oNewDiv.id = 'suggest_' + this.opt.sSuggestId + '_' + sItemId;
	oNewDiv.className = 'row';
	setInnerHTML(oNewDiv, this.sItemTemplate.replace(/%post_name%/g, this.opt.sPostName).replace(/%item_id%/g, sItemId).replace(/%item_href%/g, smf_prepareScriptUrl(smf_scripturl) + this.opt.sURLMask.replace(/%item_id%/g, sItemId)).replace(/%item_name%/g, sItemName).replace(/%images_url%/g, smf_images_url).replace(/%self%/g, this.opt.sSelf).replace(/%delete_text%/g, this.sTextDeleteItem));
	this.oItemList.appendChild(oNewDiv);

	if ('oCallback' in this && 'onAfterAddItem' in this.oCallback && typeof(this.oCallback.onAfterAddItem) == 'string')
		eval(this.oCallback.onAfterAddItem + '(' + this.opt.sSelf + ', \'' + oNewDiv.id + '\', ' + this.iItemCount + ');');
}

AutoSuggest.prototype.deleteAddedItem = function (sItemId)
{
	var oDiv = document.getElementById('suggest_' + this.opt.sSuggestId + '_' + sItemId);

	if (typeof(oDiv) == 'object' && oDiv != null)
	{
		oDiv.parentNode.removeChild(document.getElementById('suggest_' + this.opt.sSuggestId + '_' + sItemId));

		if ('oCallback' in this && 'onAfterDeleteItem' in this.oCallback && typeof(this.oCallback.onAfterDeleteItem) == 'string')
			eval(this.oCallback.onAfterDeleteItem + '(' + this.opt.sSelf + ', ' + this.iItemCount + ');');
	}

	return false;
}