function smc_AutoSuggest(oOptions)
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

smc_AutoSuggest.prototype.init = function()
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

smc_AutoSuggest.prototype.registerCallback = function(sCallbackType, sCallback)
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

// Add a result if not already done.
smc_AutoSuggest.prototype.addItemLink = function (sItemId, sItemName, bFromSubmit)
{
	// Increase the internal item count.
	this.iItemCount ++;

	// If there's a callback then call it.
	if ('oCallback' in this && 'onBeforeAddItem' in this.oCallback && typeof(this.oCallback.onBeforeAddItem) == 'string')
	{
		// If it returns false the item must not be added.
		if (!eval(this.oCallback.onBeforeAddItem + '(' + this.opt.sSelf + ', \'' + sItemId + '\');'))
			return;
	}

	var oNewDiv = document.createElement('div');
	oNewDiv.id = 'suggest_' + this.opt.sSuggestId + '_' + sItemId;
	setInnerHTML(oNewDiv, this.sItemTemplate.replace(/%post_name%/g, this.opt.sPostName).replace(/%item_id%/g, sItemId).replace(/%item_href%/g, smf_prepareScriptUrl(smf_scripturl) + this.opt.sURLMask.replace(/%item_id%/g, sItemId)).replace(/%item_name%/g, sItemName).replace(/%images_url%/g, smf_images_url).replace(/%self%/g, this.opt.sSelf).replace(/%delete_text%/g, this.sTextDeleteItem));
	this.oItemList.appendChild(oNewDiv);

	// If there's a registered callback, call it.
	if ('oCallback' in this && 'onAfterAddItem' in this.oCallback && typeof(this.oCallback.onAfterAddItem) == 'string')
		eval(this.oCallback.onAfterAddItem + '(' + this.opt.sSelf + ', \'' + oNewDiv.id + '\', ' + this.iItemCount + ');');

	// Clear the div a bit.
	this.removeLastSearchString();

	// If we came from a submit, and there's still more to go, turn on auto add for all the other things.
	this.bDoAutoAdd = this.oTextHandle.value != '' && bFromSubmit;

	// Update the fellow..
	this.autoSuggestUpdate();
}

// Delete an item that has been added, if at all?
smc_AutoSuggest.prototype.deleteAddedItem = function (sItemId)
{
	var oDiv = document.getElementById('suggest_' + this.opt.sSuggestId + '_' + sItemId);

	// Remove the div if it exists.
	if (typeof(oDiv) == 'object' && oDiv != null)
	{
		oDiv.parentNode.removeChild(document.getElementById('suggest_' + this.opt.sSuggestId + '_' + sItemId));

		// Decrease the internal item count.
		this.iItemCount --;

		// If there's a registered callback, call it.
		if ('oCallback' in this && 'onAfterDeleteItem' in this.oCallback && typeof(this.oCallback.onAfterDeleteItem) == 'string')
			eval(this.oCallback.onAfterDeleteItem + '(' + this.opt.sSelf + ', ' + this.iItemCount + ');');
	}

	return false;
}

// Hide the box.
smc_AutoSuggest.prototype.autoSuggestHide = function ()
{
	// Delay to allow events to propogate through....
	this.oHideTimer = setTimeout(this.opt.sSelf + '.autoSuggestActualHide();', 250);
}

// Do the actual hiding after a timeout.
smc_AutoSuggest.prototype.autoSuggestActualHide = function()
{
	this.oSuggestDivHandle.style.display = 'none';
	this.oSuggestDivHandle.style.visibility = 'hidden';
	this.oSelectedDiv = null;
}

// Show the box.
smc_AutoSuggest.prototype.autoSuggestShow = function()
{
	if (this.oHideTimer)
	{
		clearTimeout(this.oHideTimer);
		this.oHideTimer = false;
	}

	this.positionDiv();

	this.oSuggestDivHandle.style.visibility = 'visible';
	this.oSuggestDivHandle.style.display = '';
}

// Populate the actual div.
smc_AutoSuggest.prototype.populateDiv = function(aResults)
{
	// Cannot have any children yet.
	while (this.oSuggestDivHandle.childNodes.length > 0)
	{
		// Tidy up the events etc too.
		this.oSuggestDivHandle.childNodes[0].onmouseover = null;
		this.oSuggestDivHandle.childNodes[0].onmouseout = null;
		this.oSuggestDivHandle.childNodes[0].onclick = null;

		this.oSuggestDivHandle.removeChild(this.oSuggestDivHandle.childNodes[0]);
	}

	// Something to display?
	if (typeof(aResults) == 'undefined')
	{
		this.aDisplayData = [];
		return false;
	}

	var aNewDisplayData = [];
	for (var i = 0; i < (aResults.length > this.iMaxDisplayQuantity ? this.iMaxDisplayQuantity : aResults.length); i++)
	{
		// Create the sub element
		var oNewDivHandle = document.createElement('div');
		oNewDivHandle.sItemId = aResults[i].sItemId;
		oNewDivHandle.className = 'auto_suggest_item';
		oNewDivHandle.innerHTML = aResults[i].sItemName;
		//oNewDivHandle.style.width = this.oTextHandle.style.width;

		this.oSuggestDivHandle.appendChild(oNewDivHandle);

		// Attach some events to it so we can do stuff.
		oNewDivHandle.instanceRef = this;
		oNewDivHandle.onmouseover = function (oEvent)
		{
			this.instanceRef.itemMouseOver(this);
		}
		oNewDivHandle.onmouseout = function (oEvent)
		{
			this.instanceRef.itemMouseOut(this);
		}
		oNewDivHandle.onclick = function (oEvent)
		{
			this.instanceRef.itemClicked(this);
		}


		aNewDisplayData[i] = oNewDivHandle;
	}

	this.aDisplayData = aNewDisplayData;

	return true;
}

// Refocus the element.
smc_AutoSuggest.prototype.itemMouseOver = function (oCurElement)
{
	this.oSelectedDiv = oCurElement;
	oCurElement.className = 'auto_suggest_item_hover';
}

// Onfocus the element
smc_AutoSuggest.prototype.itemMouseOut = function (oCurElement)
{
	oCurElement.className = 'auto_suggest_item';
}

smc_AutoSuggest.prototype.onSuggestionReceived = function (oXMLDoc)
{
	var sQuoteText = '';
	var aItems = oXMLDoc.getElementsByTagName('item');
	this.aCache = [];
	for (var i = 0; i < aItems.length; i++)
	{
		this.aCache[i] = {
			sItemId: aItems[i].getAttribute('id'),
			sItemName: aItems[i].childNodes[0].nodeValue
		};

		// If we're doing auto add and we find the exact person, then add them!
		if (this.bDoAutoAdd && this.sLastSearch == this.aCache[i].sItemName)
		{
			var oReturnValue = {
				sItemId: this.aCache[i].sItemId,
				sItemName: this.aCache[i].sItemName
			};
			this.aCache = [];
			return this.addItemLink(oReturnValue.sItemId, oReturnValue.sItemName, true);
		}
	}

	// Check we don't try to keep auto updating!
	this.bDoAutoAdd = false;

	// Populate the div.
	this.populateDiv(this.aCache);

	// Make sure we can see it - if we can.
	if (aItems.length == 0)
		this.autoSuggestHide();
	else
		this.autoSuggestShow();

	return true;
}

// Get a new suggestion.
smc_AutoSuggest.prototype.autoSuggestUpdate = function ()
{
	// If there's a callback then call it.
	if ('onBeforeUpdate' in this.oCallback && typeof(this.oCallback.onBeforeUpdate) == 'string')
	{
		// If it returns false the item must not be added.
		if (!eval(this.oCallback.onBeforeUpdate + '(' + this.opt.sSelf + ');'))
			return false;
	}

	this.oRealTextHandle.value = this.oTextHandle.value;

	if (isEmptyText(this.oTextHandle))
	{
		this.aCache = [];

		this.populateDiv();

		this.autoSuggestHide();

		return true;
	}

	// Nothing changed?
	if (this.oTextHandle.value == this.sLastDirtySearch)
		return true;
	this.sLastDirtySearch = this.oTextHandle.value;

	// We're only actually interested in the last string.
	var sSearchString = this.oTextHandle.value.replace(/^("[^"]+",[ ]*)+/, '').replace(/^([^,]+,[ ]*)+/, '');
	if (sSearchString.substr(0, 1) == '"')
		sSearchString = sSearchString.substr(1);

	// Stop replication ASAP.
	var sRealLastSearch = this.sLastSearch;
	this.sLastSearch = sSearchString;

	// Either nothing or we've completed a sentance.
	if (sSearchString == '' || sSearchString.substr(sSearchString.length - 1) == '"')
	{
		this.populateDiv();
		return true;
	}

	// Nothing?
	if (sRealLastSearch == sSearchString)
		return true;

	// Too small?
	else if (sSearchString.length < this.iMinimumSearchChars)
	{
		this.aCache = [];
		this.autoSuggestHide();
		return true;
	}
	else if (sSearchString.substr(0, sRealLastSearch.length) == sRealLastSearch)
	{
		// Instead of hitting the server again, just narrow down the results...
		var aNewCache = [];
		var j = 0;
		var sLowercaseSearch = sSearchString.toLowerCase();
		for (var k = 0; k < this.aCache.length; k++)
		{
			if (this.aCache[k].sItemName.substr(0, sSearchString.length).toLowerCase() == sLowercaseSearch)
				aNewCache[j++] = this.aCache[k];
		}

		this.aCache = [];
		if (aNewCache.length != 0)
		{
			this.aCache = aNewCache;
			// Repopulate.
			this.populateDiv(this.aCache);

			// Check it can be seen.
			this.autoSuggestShow();

			return true;
		}
	}

	// Clean the text handle.
	sSearchString = sSearchString.php_to8bit().php_urlencode();

	// Get the document.
	sendXMLDocument.call(this, this.sRetrieveURL.replace(/%scripturl%/g, smf_prepareScriptUrl(smf_scripturl)).replace(/%suggest_type%/g, this.opt.sSearchType).replace(/%search%/g, sSearchString).replace(/%sessionVar%/g, this.opt.sSessionVar).replace(/%sessionID%/g, this.opt.sSessionId).replace(/%time%/g, new Date().getTime()), '', this.onSuggestionReceived);

	return true;
}