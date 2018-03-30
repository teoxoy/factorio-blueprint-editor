# factorio-blueprint-editor

A [Factorio](https://www.factorio.com) blueprint editor and renderer webapp

You can find the working website here: https://teoxoy.github.io/factorio-blueprint-editor

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

### How to change them:
Add `keybinds:ACTION=KEY,ACTION=KEY,ACTION=KEY` as a parameter to the URL

Example: `https://teoxoy.github.io/factorio-blueprint-editor?keybinds:rotate=t,pippete=p`

# TODO:
- ctrl + click to add modules
- implement more entity settings (filters, conditions)
- edit bp label and icons
- put entityInfo icon backgrounds on another layer
- pipe window
- implement the other cursorBoxes
- overlay for turrets
- show electricity-icon-unplugged for entities that are not connected to a power pole
- bp manager (manage bps and books in an editor + placement of new blueprint in an allready loaded bp)
- show bp inputs (show icons for belts)
- throughput calculator/bp analyzer/bottleneck detector
- highlight lone underground pipes/belts
- train-stop station name
- tiles support
- poles range, wires and rotations
- rotate bp
- implement circuit_wire_max_distance with visualization ((x - center_x)^2 + (y - center_y)^2 <= radius^2)
- rail endings
- rail custom bounding box
- rail rotations
- belt endings
