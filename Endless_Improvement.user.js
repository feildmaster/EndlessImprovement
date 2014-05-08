// ==UserScript==
// @name        Endless Improvement
// @description Script dedicated to improving kruv's endless battle browser game
// @namespace   http://feildmaster.com/
// @include     http://www.kruv.net/endlessBattle.html
// @version     1.2pre
// @updateURL   https://raw.githubusercontent.com/feildmaster/EndlessImprovement/master/Endless_Improvement.user.js
// @grant       none
// ==/UserScript==

// Start core infrastructure - Everything is an improvement!
var endlessImprovement = game.endlessImprovement = new ImprovementManager();

function ImprovementManager() {
    var improvements = new Array(); // PRIVATE-NESS
    
    this.add = function(improvement) {
        if (improvement instanceof Improvement) {
            improvements.push(improvement);
        }
    }
    
    function doInit() {
        for (var i in improvements) {
            try {
                improvements[i].onInit();
            } catch (e) {
                logError("init", e);
            }
        }
        // EndlessGame loads after initializing... Do the same here (we don't hook into their initialize, yet!)
        doLoad();
    }
    
    function doLoad() {
        for (var i in improvements) {
            try {
                improvements[i].onLoad();
            } catch (e) {
                logError("load", e);
            }
        }
    }
    
    function doSave() {
        for (var i in improvements) {
            try {
                improvements[i].onSave();
            } catch (e) {
                logError("save", e);
            }
        }
    }
    
    function doUpdate() {
        for (var i in improvements) {
            try {
                improvements[i].onUpdate();
            } catch (e) {
                logError("update", e);
            }
        }
    }
    
    function doReset() {
        // TODO: test resetting... and it's behavior
        for (var i in improvements) {
            try {
                improvements[i].onReset();
            } catch (e) {
                logError("reset", e);
            }
        }
    }
    
    function logError(type, error) {
        var fileName = error.fileName.slice(error.fileName.lastIndexOf("/") + 1);
        console.log("Error when handling %s: [%s (%s:%d)]", type, error, fileName, error.lineNumber);
    }
    
    // Initiallize on page ready
    $(doInit);
    
    /* Add load hook - This is not needed yet, we call load on our initialize
    var originalLoad = game.load;
    game.load = function() {
        originalLoad.apply(game);
        doLoad();
    }
    // */
    
    // Add save hook
    var originalSave = game.save;
    game.save = function() {
        originalSave.apply(game);
        doSave();
    }
    
    // Add update hook - we hook into tutorial manager as it is called last, 
    var originalUpdate = game.tutorialManager.update;
    game.tutorialManager.update = function() {
        originalUpdate.apply(game.tutorialManager);
        doUpdate();
    }
    
    // Add reset hook
    var originalReset = game.reset;
    game.reset = function() {
        originalReset.apply(game);
        doReset();
    }
}

function Improvement(init, load, save, update, reset) {
    this.onInit = function() {
        if (typeof init === 'function') { 
            init();
        }
    }
    this.onLoad = function() {
        if (typeof load === 'function') {
            load();
        }
    }
    this.onSave = function() {
        if (typeof save === 'function') {
            save();
        }
    }
    this.onUpdate = function() {
        if (typeof update === 'function') {
            update();
        }
    }
    this.onReset = function() {
        if (typeof reset === 'function') {
            reset();
        }
    }
}

Improvement.prototype.register = function() {
    endlessImprovement.add(this);
}
// End core infrastructure

// Start fix health - remove when fixed live
function fixHealth() {
    new Improvement(init).register();
    
    function init() {
        game.player.baseHealthLevelUpBonus = 0;
        game.player.baseHp5LevelUpBonus = 0;
            
        // Add stats to the player for leveling up, use the "broken" algorithm people expect.
        for (var x = 1; x < game.player.level; x++) {
            game.player.baseHealthLevelUpBonus += Math.floor(game.player.healthLevelUpBonusBase * (Math.pow(1.15, x)));
            game.player.baseHp5LevelUpBonus += Math.floor(game.player.hp5LevelUpBonusBase * (Math.pow(1.15, x)));
        }
    }
}
// Register
fixHealth();
// End fix health

// Start stats window improvement - only update when the window is open!
function statWindowImprovement() {
    new Improvement(init).register();
    
    function init() {
        var statsWindowShowing = false;
        
        $("#stats").mousedown(function() {
            statsWindowShowing = true;
        });
        $("#statsWindowExitButton").mousedown(function() {
            statsWindowShowing = false;
        });
        
        var originalStatsUpdate = game.stats.update;
        game.stats.update = function() {
            if (statsWindowShowing) {
                originalStatsUpdate.apply(game.stats);
            }
        }
    }
}
// Register
statWindowImprovement();
// End stats window improvement

// Start auto selling loot
function autoSellLoot() {
    var autoSellLoot = {
        COMMON: false,
        UNCOMMON: false,
        RARE: false,
        EPIC: false,
        LEGENDARY: false,
    };

    new Improvement(init, load, save, null, reset).register();
    
    function init() {
        // Create a new lootItem function, this saves needless calculations...
        game.inventory.lootItem = function(item) {
            for (var x = 0; x < game.inventory.maxSlots; x++) {
                if (game.inventory.slots[x] == null) {
                    // You can only sell what you can carry!
                    if (autoSellLoot[item.rarity]) {
                        sell(item);
                    } else {
                        game.inventory.slots[x] = item;
                        $("#inventoryItem" + (x + 1)).css('background', ('url("/includes/images/itemSheet2.png") ' + item.iconSourceX + 'px ' + item.iconSourceY + 'px'));
                    }
                    game.stats.itemsLooted++;
                    break;
                }
            }
        }
        // Add function to toggle selling ability
        game.autoSellOptionClick = function(option) {
            autoSellLoot[option] = !autoSellLoot[option];
            updateValue(option);
        }

        // Add rarity options
        for (var rarity in autoSellLoot) {
            $("#optionsWindowOptionsArea").append('<div class="optionsWindowOption" onmousedown="game.autoSellOptionClick(\'' + rarity + '\')">' +
                'Auto sell new <span style="color: ' + getItemColor(rarity) + '">' + rarity.formatCapitalize() + '</span> loot: ' +
                '<span id="autoSellValue' + rarity.formatCapitalize() +'">OFF</span></div>');
        }
    }
    
    function load() {
        autoSellLoot.COMMON = localStorage.endlessAutoSellLootCommon === 'true';
        autoSellLoot.UNCOMMON = localStorage.endlessAutoSellLootUncommon === 'true';
        autoSellLoot.RARE = localStorage.endlessAutoSellLootRare === 'true';
        autoSellLoot.EPIC = localStorage.endlessAutoSellLootEpic === 'true';
        autoSellLoot.LEGENDARY = localStorage.endlessAutoSellLootLegendary === 'true';
        var autoSell = localStorage.autoSellLoot;
        if (typeof(autoSell) !== "undefined") {
            localStorage.removeItem('autoSellLoot');
            if (autoSell === 'true') {
                autoSellLoot.COMMON = true;
                autoSellLoot.UNCOMMON = true;
                autoSellLoot.RARE = true;
            }
        }
        for (var rarity in ItemRarity) {
            if (rarity !== 'count') {   
                updateValue(rarity);
            }
        }
    }
    
    function save() {
        localStorage.endlessAutoSellLootCommon = autoSellLoot.COMMON;
        localStorage.endlessAutoSellLootUncommon = autoSellLoot.UNCOMMON;
        localStorage.endlessAutoSellLootRare = autoSellLoot.RARE;
        localStorage.endlessAutoSellLootEpic = autoSellLoot.EPIC;
        localStorage.endlessAutoSellLootLegendary = autoSellLoot.LEGENDARY;
    }
    
    function reset() {
        // TODO - ???
    }
    
    function sell(item) {
        // Get the sell value and give the gold to the player; don't use the gainGold function as it will include gold gain bonuses
        var value = item.sellValue;
        game.player.gold += value;
        // Increase stats!
        game.stats.itemsSold++;
        game.stats.goldFromItems += value;
    }
    
    function updateValue(option) {
        $("#autoSellValue" + option.formatCapitalize()).html(autoSellLoot[option]?"ON":"OFF");
    }
    
    function getItemColor(type) {
        switch (type) {
            case ItemRarity.COMMON: return "#fff";
            case ItemRarity.UNCOMMON: return "#00ff05";
            case ItemRarity.RARE: return "#0005ff";
            case ItemRarity.EPIC: return "#b800af";
            case ItemRarity.LEGENDARY: return "#ff6a00";
        }
    }
}
// Register
autoSellLoot();
// End auto selling loot

// Start mercenary highlighting
function mercenaryHighlighting() {
    var enableHighlight = true;
    var currentMercenary = null;
    
    new Improvement(init, load, save).register();
    
    function init() {
        var originalPurchaseMercenary = game.mercenaryManager.purchaseMercenary;
        game.mercenaryManager.purchaseMercenary = function(type) {
            originalPurchaseMercenary.apply(game.mercenaryManager, arguments);
            highlightMostEfficientMercenary();
        }
        
        // Re-calculate after buying an upgrade
        var originalPurchaseUpgrade = game.upgradeManager.purchaseUpgrade;
        game.upgradeManager.purchaseUpgrade = function(id) {
            originalPurchaseUpgrade.apply(game.upgradeManager, arguments);
            highlightMostEfficientMercenary();
        }
        
        // Add function to toggle mercenary highlighting
        game.highlightBestMercenaryClick = function() {
            enableHighlight = !enableHighlight;
            highlightMostEfficientMercenary();
            updateOption();
        }
        
        // Add option to toggle mercenary highlighting
        $("#optionsWindowOptionsArea").append('<div class="optionsWindowOption" onmousedown="game.highlightBestMercenaryClick()">' +
            '<span style="color: #ffff00;">Highlight</span> most cost efficient mercenary: <span id="highlightMercenaryValue">ON</span></div>');
    }
    
    function load() {
        enableHighlight = localStorage.endlessEnableHighlight === 'true';
        updateOption(); // Lets update on load, for lack of better place (only needs to do this once...)
        highlightMostEfficientMercenary(); // Run once on load
    }
    
    function save() {
        localStorage.endlessEnableHighlight = enableHighlight;
    }
    
    function updateOption() {
        $("#highlightMercenaryValue").html(enableHighlight?"ON":"OFF");
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
            var curValue = game.mercenaryManager[curMercenary.toLowerCase() + 'Price'] / game.mercenaryManager.getMercenaryBaseGps(curMercenary);
            
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

    function getMercenaryElement(type) {
        return $("#"+ type.toLowerCase() +"Name");
    }
}
// Register
mercenaryHighlighting();
// End mercenary highlighting

// Start bonus kill stats
function monsterKillStats() {
    // Todo: make these stats global... for quests!
    var bossKills = 0;
    var bossLevel = 0;
    var isUpdated = false;

    new Improvement(init, load, save, update).register();
    
    function init() {
        // hook into monster damage function, has to be done every time a monster is created!
        var originalMonsterCreator = game.monsterCreator.createRandomMonster;
        game.monsterCreator.createRandomMonster = function() {
            // Create a monster
            var newMonster = originalMonsterCreator.apply(game.monsterCreator, arguments);
            // Override it's takeDamage function
            var originalDamageFunction = newMonster.takeDamage;
            newMonster.takeDamage = function(damage) {
                originalDamageFunction.apply(newMonster, arguments);
                // Yay, it was killed!
                if (!newMonster.alive) {
                    monsterKilled(newMonster);
                }
            }
            
            return newMonster;
        }
    }
    
    function load() {
        if (!isNaN(localStorage.endlessBossKills)) {
            bossKills = parseInt(localStorage.endlessBossKills);
            bossLevel = parseInt(localStorage.endlessBossLevel);
        }
    
        $("#statsWindowStatsArea").append('<div class="statsWindowText"><span style="color: #F00;">Boss</span> kills at player level:</div>');
        $("#statsWindowStatValuesArea").append('<div id="statsWindowBossKills" class="statsWindowText"></div>');
        $("#statsWindowStatsArea").append('<div class="statsWindowText">Highest level <span style="color: #F00;">Boss</span> kill:</div>');
        $("#statsWindowStatValuesArea").append('<div id="statsWindowBossLevel" class="statsWindowText"></div>');
    }
    
    function save() {
        localStorage.endlessBossKills = bossKills;
        localStorage.endlessBossLevel = bossLevel;
    }
    
    function update() {
        if (isUpdated) {
            return;
        }
        $("#statsWindowBossKills").html(bossKills.formatMoney(0));
        $("#statsWindowBossLevel").html(bossLevel.formatMoney(0));
        isUpdated = true;
    }
    
    function monsterKilled(monster) {
        if (monster.rarity == MonsterRarity.BOSS) {
            if (monster.level > bossLevel) {
                bossLevel = monster.level;
                isUpdated = false;
            }
            
            if (monster.level === game.player.level) {
                bossKills++;
                isUpdated = false;
            }
        }
    }
}
// Register
monsterKillStats();
// End bonus kill stats

$("#optionsWindowOptionsArea").append('<div id="improvementOptionsTitle" class="optionsWindowOptionsTitle">Endless Improvement Options</div>');

// Start MISC - Apparently we have no access to EndlessGame's formatMoney...
Number.prototype.formatMoney = function(c, d, t) {
var n = this, 
    c = isNaN(c = Math.abs(c)) ? 2 : c, 
    d = d == undefined ? "." : d, 
    t = t == undefined ? "," : t, 
    s = n < 0 ? "-" : "", 
    i = parseInt(n = Math.abs(+n || 0).toFixed(c)) + "", 
    j = (j = i.length) > 3 ? j % 3 : 0;
   return s + (j ? i.substr(0, j) + t : "") + i.substr(j).replace(/(\d{3})(?=\d)/g, "$1" + t) + (c ? d + Math.abs(n - i).toFixed(c).slice(2) : "");
 }
 
String.prototype.formatCapitalize = function() {
    return this.charAt(0).toUpperCase() + this.slice(1).toLowerCase();
};
// End MISC