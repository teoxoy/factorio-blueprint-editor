<img src="./src/logo.svg" width="128" align="right">

<br/>
<br/>
<br/>

# factorio-blueprint-editor

A [Factorio](https://www.factorio.com) blueprint editor and renderer webapp

You can find the working website here: https://teoxoy.github.io/factorio-blueprint-editor

Sample blueprint: https://teoxoy.github.io/factorio-blueprint-editor/?source=https://pastebin.com/uc4n81GP

Example link that uses url query parameters: https://teoxoy.github.io/factorio-blueprint-editor/?lightTheme&keybinds:rotate=t,pippete=p&index=1&source=https://pastebin.com/Xp9u7NaA

# Contributing

Feel free to contribute to this project, if you have any questions you can contact me on discord (Teoxoy#6734).

# Changing the keybinds

### Configurable keybinds and their default values:
- rotate: 'r'
- pippete: 'q'
- undo: 'modifier+z'
- redo: 'modifier+y'
- picture: 'shift+s'
- clear: 'shift+n'
- overlay: 'alt'
- closeWindow: 'esc'
- inventory: 'e'
- focus: 'f'
- w: 'w'
- a: 'a'
- s: 's'
- d: 'd'
- increaseTileArea: ']'
- decreaseTileArea: '['

### How to change them:
Add `keybinds:ACTION=KEY,ACTION=KEY,ACTION=KEY` as a parameter to the URL

Example: `https://teoxoy.github.io/factorio-blueprint-editor?keybinds:rotate=t,pippete=p`

# TODO:
- implement more entity settings (filters, conditions)
- edit bp label and icons
- pipe window
- implement the other cursorBoxes
- overlay for turrets
- show electricity-icon-unplugged for entities that are not connected to a power pole
- bp manager (manage bps and books in an editor + placement of new blueprint in an allready loaded bp)
- show bp inputs (show icons for belts)
- throughput calculator/bp analyzer/bottleneck detector
- highlight lone underground pipes/belts
- train-stop station name
- poles range, wires and rotations
- rotate bp
- implement circuit_wire_max_distance with visualization ((x - center_x)^2 + (y - center_y)^2 <= radius^2)
- rail endings
- rail custom bounding box
- rail rotations
- belt endings
- tile edges
- tile history
