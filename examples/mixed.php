<style>
	div    {
		   display  :    block
	}
</style>
<script>
	     function    foo(    ) {    return 5 }
</script>
			<?php 
			function helper(   )   {
				echo   "help" ;
			} ?>
<div>
	<?php       foreach   (  [1,   2,3,4] as $n) {?>
		<span><?=helper().$n;?>-<?php echo $n;?></span>
	<?php

} ?>
</div>