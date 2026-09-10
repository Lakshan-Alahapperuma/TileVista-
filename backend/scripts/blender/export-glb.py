"""Export only the measured reconstruction; never substitute stock geometry."""
import os
import sys
import bpy

args = sys.argv[sys.argv.index("--") + 1:]
if len(args) != 2:
    raise RuntimeError("Expected reconstruction and output directories")
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.ply_import(filepath=os.path.join(args[0], "mesh.ply"))
meshes = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
if not meshes or not any(len(obj.data.polygons) for obj in meshes):
    raise RuntimeError("Reconstruction contains no surface faces")
# Preserve reconstructed coordinates and vertex colors; no invented dimensions.
for obj in meshes:
    if obj.data.color_attributes:
        material = bpy.data.materials.new(name="Captured surface")
        material.use_nodes = True
        nodes = material.node_tree.nodes
        color = nodes.new('ShaderNodeVertexColor')
        color.layer_name = obj.data.color_attributes[0].name
        material.node_tree.links.new(color.outputs['Color'], nodes.get('Principled BSDF').inputs['Base Color'])
        obj.data.materials.append(material)
os.makedirs(args[1], exist_ok=True)
bpy.ops.export_scene.gltf(filepath=os.path.join(args[1], "model.glb"), export_format='GLB', export_apply=True)
