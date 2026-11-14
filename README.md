# Featurewise diagrams

Draws a featurewise service as a picture: each feature a toy boat seen from below, with its name along the keel, and each link an arc from the bow of the feature that offers it to the stern of the feature it invokes. The arrangement is found by simulated annealing against a fitness function that says what makes such a picture look good, and a page in the browser lets you watch it happen.

## Extractor (C#)

Reads a service's compiled assembly and writes its feature graph as JSON: every feature, with its family and result cases, and every link a feature's result can offer, with the place in the result that holds it. It reads the assembly's metadata without running its code, so the assembly's folder must also hold its dependencies, `Featurewise.dll` among them, as a test project's output does.

```
dotnet run --project Extractor -- ../demos/LostProperty/Demos.LostProperty.Tests/bin/Debug/net10.0/Demos.LostProperty.dll -o Layout/public/lost-property.json
```

## Layout (TypeScript)

```
cd Layout
npm install
npm run dev          # the page: watch it anneal, change the weights, download the SVG
npm run layout -- public/lost-property.json ../out/lost-property.svg --seed 3
npm test
```

The page takes `?graph=<file>` for another graph in `public/`.

- `boat.ts`: the hull, from Adam's toy-boat drawing: a rounded point at the bow, a square stern with rounded corners. The bow and stern scale with the beam, and the sides stretch to fit the name.
- `layout.ts`: where each boat is and which way it points, and the curve for each link. A link leaves a bow the way it points and arrives at a stern the way that boat points; a link to itself loops beside the boat.
- `fitness.ts`: the rules, each a weighted penalty: crowding, crossings, links through boats, bends, link lengths, uneven spacing, skew from the axes, near misses in alignment, sprawl, boats pointing backwards, boats standing upright rather than lying along the page, and boats with no links (strays, such as workers) apart from each other.
- `anneal.ts`: the annealing. A change for the better is always kept, and one for the worse with probability e^(-worsening / temperature). Changes start big and to several boats at once, and end small and to one; the temperature falls geometrically over the run, from one at which a typical worsening is kept half the time.
- `render.ts`: the SVG. Names read stern to bow, as on the toy boat, unless that would turn them upside down.

Workers have no links to them, since events trigger them, so for now they float free of the others.
