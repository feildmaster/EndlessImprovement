// ==UserScript==
// @name        Endless Improvement
// @description Script dedicated to improving kruv's endless battle browser game
// @namespace   http://feildmaster.com/
// @include     http://www.kruv.net/endlessBattle.html
// @version     1.1pre
// @grant       none
// ==/UserScript==

// Start variables - our custom variables...
var autoSellLoot = false;
var enableHighlight = true;
function endlessInit() {
    // Load Options
    if (typeof (Storage) !== "undefined" && localStorage.endlessSaved != null) {
        // Load our options
        autoSellLoot = localStorage.endlessAutoSellLoot == 'true';
        enableHighlight = localStorage.endlessEnableHighlight == 'true';
    }
    highlightMostEfficientMercenary(); // Run once on load
}

function endlessSave() {
    localStorage.endlessSaved = 1;
    localStorage.endlessAutoSellLoot = autoSellLoot;
    localStorage.endlessEnableHighlight = enableHighlight;
}
// End variables

// Start "Selling Inventory Items"
game.inventory.sell = function sell(item) {
    // Get the sell value and give the gold to the player; don't use the gainGold function as it will include gold gain bonuses
    var value = item.sellValue;
    game.player.gold += value;
    // Increase stats!
    game.stats.itemsSold++;
    game.stats.goldFromItems += value;
}

game.inventory.lootItem = function lootItem(item) {
    for (var x = 0; x < game.inventory.maxSlots; x++) {
        if (game.inventory.slots[x] == null) {
            // You can only sell what you can carry!
            if (autoSellLoot && !(item.rarity == ItemRarity.LEGENDARY || item.rarity == ItemRarity.EPIC)) {
                game.inventory.sell(item);
            } else {
                game.inventory.slots[x] = item;
                $("#inventoryItem" + (x + 1)).css('background', ('url("/includes/images/itemSheet2.png") ' + item.iconSourceX + 'px ' + item.iconSourceY + 'px'));
            }
            game.stats.itemsLooted++;
            break;
        }
    }
}
// End selling items

// Start fixing health - can be removed when fixed live
game.player.baseHealthLevelUpBonus = 0;
game.player.baseHp5LevelUpBonus = 0;
    
// Add stats to the player for leveling up
for (var x = 1; x < game.player.level; x++) {
    game.player.baseHealthLevelUpBonus += Math.floor(game.player.healthLevelUpBonusBase * (Math.pow(1.15, x)));
    game.player.baseHp5LevelUpBonus += Math.floor(game.player.hp5LevelUpBonusBase * (Math.pow(1.15, x)));
}
// End fixing health

// Start mercenary highlighting
var currentMercenary = null;

game.mercenaryManager.originalPurchaseMercenary = game.mercenaryManager.purchaseMercenary;
game.mercenaryManager.purchaseMercenary = function perchaseMercenary(type) {
    game.mercenaryManager.originalPurchaseMercenary(type);
    highlightMostEfficientMercenary();
}

// Re-calculate after buying an upgrade
game.upgradeManager.originalPurchaseUpgrade = game.upgradeManager.purchaseUpgrade;
game.upgradeManager.purchaseUpgrade = function purchaseUpgrade(id) {
    game.upgradeManager.originalPurchaseUpgrade(id);
    highlightMostEfficientMercenary();
}

function highlightMostEfficientMercenary() {
    if (!enableHighlight) {
        removeHighlight();
        currentMercenary = null;
        return;
    }
    var newMercenary;
    var newValue = 0;
    
    for (var curMercenary in MercenaryType) {
        var curValue = getMercenaryCost(curMercenary) / game.mercenaryManager.getMercenaryBaseGps(curMercenary);
        
        if (newMercenary == null || curValue < newValue) {
            newMercenary = curMercenary;
            newValue = curValue;
        }
    }
    
    // Only update if changed
    if (currentMercenary != newMercenary) {
        removeHighlight(); 
        currentMercenary = newMercenary;
        getMercenaryElement(newMercenary).css('color', '#ffff00');
    }
}

function removeHighlight() {
    if (currentMercenary) {
        getMercenaryElement(currentMercenary).css('color', '#fff');
    }
}

function getMercenaryCost(type) {
    switch (type) {
    case MercenaryType.FOOTMAN:
        return game.mercenaryManager.footmanPrice;
    case MercenaryType.CLERIC:
        return game.mercenaryManager.clericPrice;
    case MercenaryType.COMMANDER:
        return game.mercenaryManager.commanderPrice;
    case MercenaryType.MAGE:
        return game.mercenaryManager.magePrice;
    case MercenaryType.THIEF:
        return game.mercenaryManager.thiefPrice;
    case MercenaryType.WARLOCK:
        return game.mercenaryManager.warlockPrice;
    }
}

function getMercenaryElement(type) {
    return $("#"+ type.toLowerCase() +"Name");
}
// End mercenary highlighting

// Order is important. Initialize before adding our options
endlessInit();

// Start insert script options
// Override option saving (so we can save our variables!)
game.options.originalSave = game.options.save;
game.options.save = function save() {
    game.options.originalSave();
    endlessSave();
}
$("#optionsWindowOptionsArea").append('<div id="improvementOptionsTitle" class="optionsWindowOptionsTitle">Endless Improvement Options</div>');
// Add function to toggle selling ability
game.autoSellOptionClick = function autoSellOptionClick() {
    autoSellLoot = !autoSellLoot;
    $("#autoSellValue").html(autoSellLoot?"ON":"OFF");
}
// Add option for auto sell inventory items
$("#optionsWindowOptionsArea").append('<div class="optionsWindowOption" onmousedown="game.autoSellOptionClick()">Auto sell new (non-rare) loot: <span id="autoSellValue">OFF</span></div>');
// Add function to toggle mercenary highlighting
game.highlightBestMercenaryClick = function highlightBestMercenaryClick() {
    enableHighlight = !enableHighlight;
    highlightMostEfficientMercenary();
    $("#highlightMercenaryValue").html(enableHighlight?"ON":"OFF");
}
// Add option to toggle mercenary highlighting
$("#optionsWindowOptionsArea").append('<div class="optionsWindowOption" onmousedown="game.highlightBestMercenaryClick()">Highlight most cost efficient mercenary: <span id="highlightMercenaryValue">' + (enableHighlight?"ON":"OFF") + '</span></div>');
// End insert script options