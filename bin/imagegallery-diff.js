#!/usr/bin/env node
const fs = require("fs");
const program = require("commander");
const request = require('request')
const PNG = require('pngjs').PNG;
const pixelmatch = require('pixelmatch');

program
  .option("-t, --target <target>", "The newly created image gallery file")
  .option(
    "-b, --base <base>",
    "The base image gallery file to compare against"
  )
  .option("-o, --output <output>", "the output file to create")
program.parse(process.argv);

if ((program.target == null) || (program.base == null) || (program.output == null)) {
  console.log("Missing parameters, unable to continue")
  process.exit(1)
}

let targetImages = JSON.parse(fs.readFileSync(program.target))
let baseImages = JSON.parse(fs.readFileSync(program.base))
let output = {
  changed: [],
  new: [],
  removed: []
}

let toCompare = []

// First we search through the new images to see if we have any matches. This will
// allow us to compare them and capture any new images not in the base
targetImages.images.forEach(image => {
  let found = false
  baseImages[0].contents.images.forEach(baseImage => {
    if (image.title === baseImage.title) {
      found = true
      toCompare.push({target: image, base: baseImage})
    }
  })

  if (found == false) {
    output.new.push(image)
  }
})

// Finally do a simple pass in reverse to see if we find any that have been removed
baseImages[0].contents.images.forEach(image => {
  let found = false
  targetImages.images.forEach(targetImage => {
    if (image.title === targetImage.title) {
      found = true
    }
  })

  if (found == false) {
    output.removed.push(image)
  }
})

gatherOutput()

async function gatherOutput() {
  for (const compare of toCompare) {
    await compareImages(compare.target, compare.base)
  }

  console.log("Image comparision results:")
  console.log("Found " + output.changed.length + " changed image(s)")
  console.log("Found " + output.new.length + " new image(s)")
  console.log("Found " + output.removed.length + " removed image(s)")

  fs.writeFileSync(program.output, JSON.stringify(output))
}

async function compareImages(target, base) {
  await download(target.url, 'target.png')
  await download(base.url, 'base.png')

  const img1 = PNG.sync.read(fs.readFileSync('target.png'));
  const img2 = PNG.sync.read(fs.readFileSync('base.png'));
  const {width, height} = img1;
  
  const pixelDiff = pixelmatch(img1.data, img2.data, null, width, height, {threshold: 0.1, includeAA: true});
  if (pixelDiff > 0) {
    output.changed.push({
      target: target,
      base: base
    })
  }
}

async function download(url, path) {
  return new Promise((resolve) => {
    request.head(url, (err, res, body) => {
      request(url)
        .pipe(fs.createWriteStream(path))
        .on('close', function() {
          resolve()
        })
    })
  })
}