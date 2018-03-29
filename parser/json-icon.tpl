{
  "frames": {
    <% layout.images.forEach(function (image, idx)
    { %>"<%= image.className %>": {
      "frame": { "x": <%= image.x %>, "y": <%= image.y %>, "w": <%= image.width %>, "h": <%= image.height %> },
      "sourceSize": { "w": <%= image.width %>, "h": <%= image.height %> }
    }<% if (idx !== layout.images.length - 1) { %>,<% } %>
    <% }); %>
  },
  "meta": { "image": "iconSprites.png" }
}
