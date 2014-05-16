// ==UserScript==
// @name        Endless Improvement
// @author      feildmaster
// @description Script dedicated to improving kruv's endless battle browser game
// @namespace   http://feildmaster.com/
// @include     http://www.kruv.net/endlessBattle.html
// @version     1.3.2pre
// @updateURL   https://raw.githubusercontent.com/feildmaster/EndlessImprovement/release/Endless_Improvement.meta.js
// @downloadURL https://raw.githubusercontent.com/feildmaster/EndlessImprovement/release/Endless_Improvement.user.js
// @source      https://github.com/feildmaster/EndlessImprovement/
// @grant       none
// ==/UserScript==

// Start core infrastructure - Everything is an improvement!
var endlessImprovement = game.endlessImprovement = new ImprovementManager();

function ImprovementManager() {
    this.currentTime = 0; // Is updated on updates
    var improvements = new Array(); // PRIVATE-NESS
    var pending = new Array();

    this.add = function(improvement) {
        if (improvement instanceof Improvement) {
            pending.push(improvement);
        }
    }

    function doInit() {
        for (var i in pending) {
            try {
                pending[i].onInit();
            } catch (e) {
                logError("init", e);
            }
        }
        // EndlessGame loads after initializing... Do the same here (we don't hook into their initialize, yet!)
        doLoad();
    }

    function doLoad() {
        while (pending.length > 0) {
            var improvement = pending.pop();
            try {
                improvement.onLoad();
                improvements.push(improvement);
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
        // Check for pending improvements
        if (pending.length > 0) {
            doInit();
        }
    }

    function doReset() {
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

    // Add update hook - use of unsafeWindow is bad. :(
    var unsafeDefined = 'undefined' !== typeof unsafeWindow;
    var originalUpdate = unsafeDefined ? unsafeWindow.update : game.tutorialManager.update;
    
    if (unsafeDefined) {
        unsafeWindow.update = function() {
            endlessImprovement.currentTime = Date.now();
            originalUpdate();
            doUpdate();
        }
    } else {
        game.tutorialManager.update = function() {
            endlessImprovement.currentTime = Date.now();
            originalUpdate.apply(game.tutorialManager);
            doUpdate();
        }
    }

    // Add reset hook
    var originalReset = game.reset;
    game.reset = function() {
        originalReset.apply(game);
        if (!unsafeDefined) {
            // We need to readd the update hook... because the game makes a new manager
            originalUpdate = game.tutorialManager.update;
            game.tutorialManager.update = function() {
                endlessImprovement.currentTime = Date.now();
                originalUpdate.apply(game.tutorialManager);
                doUpdate();
            }
        }
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
        addHooks();

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
            updateValue(rarity);
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
        // Set all rarities to false
        for (var i in autoSellLoot) {
            autoSellLoot[i] = false;
            updateValue(i);
        }
        addHooks();
    }

    function sell(item) {
        // Get the sell value and give the gold to the player; don't use the gainGold function as it will include gold gain bonuses
        var value = item.sellValue;
        game.player.gold += value;
        // Increase stats!
        game.stats.itemsSold++;
        game.stats.goldFromItems += value;
    }

    function addHooks() {
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
    }

    function updateValue(option) {
        $("#autoSellValue" + option.formatCapitalize()).html(autoSellLoot[option]?"ON":"OFF");
    }

    function getItemColor(type) {
        switch (type) {
            case ItemRarity.COMMON:
                return "#fff";
            case ItemRarity.UNCOMMON:
                return "#00ff05";
            case ItemRarity.RARE:
                return "#0005ff";
            case ItemRarity.EPIC:
                return "#b800af";
            case ItemRarity.LEGENDARY:
                return "#ff6a00";
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

    new Improvement(init, load, save, null, reset).register();

    function init() {
        addHooks();

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
        if (localStorage.endlessEnableHighlight) {
            enableHighlight = localStorage.endlessEnableHighlight === 'true';
        }
        updateOption(); // Lets update on load, for lack of better place (only needs to do this once...)
        highlightMostEfficientMercenary(); // Run once on load
    }

    function save() {
        localStorage.endlessEnableHighlight = enableHighlight;
    }

    function reset() {
        addHooks();
    }

    function addHooks() {
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
    endlessImprovement.bossKills = 0;
    var bossLevel = 0;
    var isUpdated = false;

    new Improvement(init, load, save, update, reset).register();

    function init() {
        addHooks();
    }

    function load() {
        if (localStorage.endlessBossKills) {
            endlessImprovement.bossKills = parseInt(localStorage.endlessBossKills);
            bossLevel = parseInt(localStorage.endlessBossLevel);
        }

        $("#statsWindowStatsArea").append('<div class="statsWindowText"><span style="color: #F00;">Boss</span> kills at player level:</div>');
        $("#statsWindowStatValuesArea").append('<div id="statsWindowBossKills" class="statsWindowText"></div>');
        $("#statsWindowStatsArea").append('<div class="statsWindowText">Highest level <span style="color: #F00;">Boss</span> kill:</div>');
        $("#statsWindowStatValuesArea").append('<div id="statsWindowBossLevel" class="statsWindowText"></div>');
    }

    function save() {
        localStorage.endlessBossKills = endlessImprovement.bossKills;
        localStorage.endlessBossLevel = bossLevel;
    }

    function update() {
        if (isUpdated) {
            return;
        }
        $("#statsWindowBossKills").html(endlessImprovement.bossKills.formatMoney(0));
        $("#statsWindowBossLevel").html(bossLevel.formatMoney(0));
        isUpdated = true;
    }

    function reset() {
        endlessImprovement.bossKills = 0;
        bossLevel = 0;
        isUpdated = false;
        addHooks();
    }

    function monsterKilled(monster) {
        if (monster.rarity == MonsterRarity.BOSS) {
            if (monster.level > bossLevel) {
                bossLevel = monster.level;
                isUpdated = false;
            }

            if (monster.level === game.player.level) {
                endlessImprovement.bossKills++;
                isUpdated = false;
            }
        }
    }

    function addHooks() {
        // hook into monster damage function, has to be done every time a monster is created!
        var originalMonsterCreator = game.monsterCreator.createRandomMonster;
        game.monsterCreator.createRandomMonster = function() {
            // Create a monster
            var newMonster = originalMonsterCreator.apply(game.monsterCreator, arguments);
            // Override it's takeDamage function
            var originalDamageFunction = newMonster.takeDamage;
            newMonster.takeDamage = function(damage) {
                // Lets not continue if they're already dead
                if (!newMonster.alive) {
                    return;
                }
                originalDamageFunction.apply(newMonster, arguments);
                // Yay, it was killed!
                if (!newMonster.alive) {
                    monsterKilled(newMonster);
                }
            }

            return newMonster;
        }
    }
}
// Register
monsterKillStats();
// End bonus kill stats

// Start monster kill quests
function monsterKillQuests() {
    var bossKillPercentage = 10;

    new Improvement(null, load, save, update, reset).register();
    QuestType.ENDLESS_BOSSKILL  = "EndlessBossKill";

    // Last level it was awarded (Updates to current level even if it was rolled over from past level)
    var killLevelAwarded = 0;

    function load() {
        if (localStorage.endlessKillLevelAwarded) {
            killLevelAwarded = parseInt(localStorage.endlessKillLevelAwarded);
        }
    }

    function save() {
        localStorage.endlessKillLevelAwarded = killLevelAwarded;
    }

    function update() {
        // You can't gain this quest if you aren't at least level 30
        if (game.player.level < 30) {
            return;
        }
        // Create if needed
        findOrCreate();
    }

    function reset() {
        killLevelAwarded = 0;
    }

    function findOrCreate() {
        var quest;
        for (var x = game.questsManager.quests.length - 1; x >= 0; x--) {
            var c = game.questsManager.quests[x];
            if (c.type == QuestType.ENDLESS_BOSSKILL) {
                quest = c;
                hookBossKillQuest(quest);
                break;
            }
        }

        if (!quest) { // Give the quest... if we can
            addBossKillQuest();
        }

        // Always set to current level
        if (killLevelAwarded != game.player.level) {
            killLevelAwarded = game.player.level;
        }
    }

    function addBossKillQuest() {
        if (game.player.level >= 30 && killLevelAwarded < game.player.level) {
            var name = "Kill a boss";
            var description = "Kill a boss equal to your level, prove your worth!";
            var quest = new Quest(name, description, QuestType.ENDLESS_BOSSKILL, 0, endlessImprovement.bossKills, 0, bossKillPercentage + '%');
            hookBossKillQuest(quest);
            game.questsManager.addQuest(quest);
        }
    }

    // The quest will be completely broken if this is NOT called correctly
    function hookBossKillQuest(quest) {
        if (quest.hooked) {
            return;
        }
        // overrides update and reward
        quest.update = updateBossKillQuest;
        quest.grantReward = rewardBossKillQuest;
        // mark as hooked, so we don't do hook again
        quest.hooked = true;
    }

    function updateBossKillQuest() {
        // Complete if we have more kills than when this quest was made
        this.complete = endlessImprovement.bossKills > this.typeAmount;
    }

    function rewardBossKillQuest() {
        game.player.gainExperience(Math.ceil(game.player.experienceRequired * bossKillPercentage / 100), false);
        game.stats.experienceFromQuests += game.player.lastExperienceGained;
    }
}
// Register
monsterKillQuests();
// End monster kill quests

// Start DPS - inspired by FrozenBattle https://github.com/Craiel/FrozenBattle/
function DPS() {
    var damageDealt = 0;
    var lastUpdate = 0;
    var enabled = false;

    new Improvement(init, load, save, update, reset).register();

    function init() {
        addHooks();

        game.toggleDPSClick = function() {
            enabled = !enabled;
            updateOption();
        }

        // Add option
        $("#optionsWindowOptionsArea").append('<div class="optionsWindowOption" onmousedown="game.toggleDPSClick()">' +
            'Enable damage per second: <span id="dpsValue">OFF</span></div>');
        // Add ugly bit for dps
        $("#combatArea").append('<div id="dpsDisplay" style="position: absolute; top: 52px; left: 625px; font-family: \'Gentium Book Basic\'; font-size: 20px; color: #ffd800;text-shadow: 2px 0 0 #000, -2px 0 0 #000, 0 2px 0 #000, 0 -2px 0 #000, 1px 1px #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000;-moz-user-select: -moz-none;-khtml-user-select: none;-webkit-user-select: none;-ms-user-select: none;user-select: none;">' +
            '<span id="dps">0</span> dps</div>');
    }

    function load() {
        if (localStorage.dpsEnabled) {
            enabled = localStorage.dpsEnabled === "true";
        }

        updateOption();
    }

    function save() {
        localStorage.dpsEnabled = enabled;
    }

    function update() {
        if (enabled && endlessImprovement.currentTime - lastUpdate > 1000) {
            $("#dps").html(damageDealt === 0 ? 0 : damageDealt.formatMoney());
            damageDealt = 0;
            
            // Center the dps... :3
            var dps = $("#dpsDisplay");
            var pix = 625 - dps.width() / 2;
            dps.css('left', pix + 'px');
            
            lastUpdate = endlessImprovement.currentTime;
        }
    }

    function reset() {
        addHooks();
    }

    function updateOption() {
        $("#dpsValue").html(enabled ? "ON" : "OFF");
        if (enabled) {
            $("#dpsDisplay").show();
        } else {
            $("#dpsDisplay").hide();
        }
    }

    function addHooks() {
        // hook into monster damage function, has to be done every time a monster is created!
        var originalMonsterCreator = game.monsterCreator.createRandomMonster;
        game.monsterCreator.createRandomMonster = function() {
            // Create a monster
            var newMonster = originalMonsterCreator.apply(game.monsterCreator, arguments);
            // Override it's takeDamage function
            var originalDamageFunction = newMonster.takeDamage;
            newMonster.takeDamage = function(damage) {
                // Lets not continue if they're already dead
                if (!this.alive) {
                    return;
                }
                originalDamageFunction.apply(this, arguments);
                if (enabled) {
                    damageDealt += this.lastDamageTaken;
                }
            }

            return newMonster;
        }
    }
}
DPS();
// End DPS

$("#optionsWindowOptionsArea").append('<div id="improvementOptionsTitle" class="optionsWindowOptionsTitle">Endless Improvement Options</div>');

// Start MISC - Apparently we have no access to EndlessGame's formatMoney...
Number.prototype.formatMoney = function(c, d, t) {
    var n = this,
    s = n < 0 ? "-" : "",
    i = parseInt(n = Math.abs(+n || 0).toFixed(c)) + "",
    j = (j = i.length) > 3 ? j % 3 : 0;
    c = isNaN(c = Math.abs(c)) ? 2 : c;
    d = d == undefined ? "." : d;
    t = t == undefined ? "," : t;
    return s + (j ? i.substr(0, j) + t : "") + i.substr(j).replace(/(\d{3})(?=\d)/g, "$1" + t) + (c ? d + Math.abs(n - i).toFixed(c).slice(2) : "");
}

String.prototype.formatCapitalize = function() {
    return this.charAt(0).toUpperCase() + this.slice(1).toLowerCase();
};
// End MISC
